import 'dotenv/config';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import createDebug from 'debug';

const debug = createDebug('api:util:encryption');

export const EncryptionInfoSymbol = Symbol('EncryptionInfo');

export interface EncryptionInfo {
	/** 0 = legacy plaintext, 1 = Original AES-256-GCM, 2 = New AES-256-GCM with key id + AAD. */
	version: 0 | 1 | 2;
	needs_update: boolean;
	keyId?: string;
}

export type Decrypted = Buffer & { [EncryptionInfoSymbol]: EncryptionInfo };

const VERSION_LEGACY = 0;
const VERSION_V1 = 1;
/** [version][key id][iv][ciphertext][auth tag]. */
const VERSION_V2 = 2;

const KEY_LENGTH = 32;
const KEY_ID_LENGTH = 4;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const HKDF_NAMESPACE = 'coralsvelte/v2/';

interface KeyEntry {
	id: Buffer;
	idHex: string;
	key: Buffer;
	current: boolean;
}

export function encryptionPurpose(table: string, column: string): string {
	return `${table}.${column}`;
}

export class EncryptionUtil {
	private readonly current: KeyEntry;
	private readonly byId: Map<string, KeyEntry>;
	private readonly previous: KeyEntry[];
	private readonly purposeKeys = new Map<string, Buffer>();

	constructor(
		key_encrypt = Buffer.from(process.env.APP_KEY ?? '', 'base64url'),
		key_decrypt = (process.env.APP_KEY_PREVIOUS ?? '')
			.split(/,|\n/)
			.map((line) => line.replace(/#.*$/, '').trim())
			.filter(Boolean)
			.map((k) => Buffer.from(k, 'base64url'))
	) {
		if (key_encrypt.length !== KEY_LENGTH) {
			throw new Error('Invalid encryption key length');
		}

		this.current = this.deriveEntry(key_encrypt, true);
		this.byId = new Map([[this.current.idHex, this.current]]);
		this.previous = [];

		key_decrypt.forEach((key, index) => {
			if (key.length !== KEY_LENGTH) {
				throw new Error('Invalid decryption key (#' + index + ') length');
			}

			const entry = this.deriveEntry(key, false);
			const existing = this.byId.get(entry.idHex);

			if (existing) {
				if (!existing.key.equals(key)) {
					throw new Error('Encryption key id collision');
				}

				return;
			}

			this.byId.set(entry.idHex, entry);
			this.previous.push(entry);
		});
	}

	get currentKeyId(): string {
		return this.current.idHex;
	}

	/**
	 * encrypts bytes into the v2 encryption layout
	 * [version (1)] [key id (4)] [iv (12)] [ciphertext] [auth tag (16)]
	 *
	 * `purpose` is authenticated, so a blob only decrypts back for the exact
	 * table/column it was written for.
	 */
	encrypt(data: Uint8Array, purpose: string): Buffer {
		const entry = this.current;
		const iv = randomBytes(IV_LENGTH);

		const cipher = createCipheriv('aes-256-gcm', this.purposeKey(purpose, entry), iv, {
			authTagLength: TAG_LENGTH
		});
		cipher.setAAD(this.aad(purpose, entry));

		return Buffer.concat([
			Buffer.from([VERSION_V2]),
			entry.id,
			iv,
			cipher.update(data),
			cipher.final(),
			cipher.getAuthTag()
		]);
	}

	encryptString(data: string, purpose: string): Buffer {
		return this.encrypt(Buffer.from(data, 'utf-8'), purpose);
	}

	encryptJson<T>(data: T, purpose: string): Buffer {
		return this.encryptString(JSON.stringify(data), purpose);
	}

	decrypt(data: Uint8Array, purpose: string): Decrypted {
		if (data.length === 0) {
			throw new Error('Invalid encrypted data');
		}

		if (data[0] === VERSION_LEGACY) {
			debug(
				'Decrypting legacy plaintext value — this path should be removed once migration is complete'
			);

			return Object.assign(Buffer.from(data).subarray(1), {
				[EncryptionInfoSymbol]: {
					version: VERSION_LEGACY,
					needs_update: true
				} satisfies EncryptionInfo
			});
		}

		if (data[0] === VERSION_V1) {
			return this.decryptV1(Buffer.from(data));
		}

		if (data[0] === VERSION_V2) {
			return this.decryptV2(Buffer.from(data), purpose);
		}

		throw new Error('Invalid encrypted data');
	}

	decryptString(data: Uint8Array, purpose: string): string {
		const result = this.decrypt(data, purpose);
		return result.toString('utf-8');
	}

	decryptJson<T>(data: Uint8Array, purpose: string): T {
		const result = this.decryptString(data, purpose);
		return JSON.parse(result) as T;
	}

	/**
	 * v1 blobs carry no key id, so the only way to find the key is to try
	 * the current key then iterate through the previous keys
	 */
	private decryptV1(data: Buffer): Decrypted {
		if (data.length < 1 + IV_LENGTH + TAG_LENGTH) {
			throw new Error('Invalid encrypted data (v1)');
		}

		for (const entry of [this.current, ...this.previous]) {
			try {
				const result = this.tryDecryptKey(data, entry);

				if (!entry.current) {
					debug('Decrypted v1 with a previous key — value should be re-encrypted');
				}

				return Object.assign(result, {
					[EncryptionInfoSymbol]: {
						version: VERSION_V1,
						needs_update: true,
						keyId: entry.idHex
					} satisfies EncryptionInfo
				});
			} catch {
				// next one
			}
		}

		throw new Error('Invalid encrypted data (v1)');
	}

	private tryDecryptKey(data: Buffer, entry: KeyEntry): Buffer {
		const decipher = createDecipheriv('aes-256-gcm', entry.key, data.subarray(1, 1 + IV_LENGTH), {
			authTagLength: TAG_LENGTH
		});

		decipher.setAuthTag(data.subarray(data.length - TAG_LENGTH));

		return Buffer.concat([
			decipher.update(data.subarray(1 + IV_LENGTH, data.length - TAG_LENGTH)),
			decipher.final()
		]);
	}

	private decryptV2(data: Buffer, purpose: string): Decrypted {
		const headerLength = 1 + KEY_ID_LENGTH;

		if (data.length < headerLength + IV_LENGTH + TAG_LENGTH) {
			throw new Error('Invalid encrypted data (v2: malformed)');
		}

		const entry = this.byId.get(data.subarray(1, headerLength).toString('hex'));

		if (!entry) {
			throw new Error('Invalid encrypted data (v2: unknown key id)');
		}

		const decipher = createDecipheriv(
			'aes-256-gcm',
			this.purposeKey(purpose, entry),
			data.subarray(headerLength, headerLength + IV_LENGTH),
			{ authTagLength: TAG_LENGTH }
		);
		decipher.setAAD(this.aad(purpose, entry));
		decipher.setAuthTag(data.subarray(data.length - TAG_LENGTH));

		const result = Buffer.concat([
			decipher.update(data.subarray(headerLength + IV_LENGTH, data.length - TAG_LENGTH)),
			decipher.final()
		]);

		return Object.assign(result, {
			[EncryptionInfoSymbol]: {
				version: VERSION_V2,
				needs_update: !entry.current,
				keyId: entry.idHex
			} satisfies EncryptionInfo
		});
	}

	private deriveEntry(key: Buffer, current: boolean): KeyEntry {
		const id = Buffer.from(
			hkdfSync('sha256', key, '', HKDF_NAMESPACE + 'key-id', KEY_LENGTH)
		).subarray(0, KEY_ID_LENGTH);

		return { id, idHex: id.toString('hex'), key, current };
	}

	private purposeKey(purpose: string, entry: KeyEntry): Buffer {
		if (!purpose) {
			throw new Error('Encryption purpose is required');
		}

		const cacheKey = `${entry.idHex}:${purpose}`;
		let key = this.purposeKeys.get(cacheKey);

		if (!key) {
			key = Buffer.from(hkdfSync('sha256', entry.key, '', HKDF_NAMESPACE + purpose, KEY_LENGTH));
			this.purposeKeys.set(cacheKey, key);
		}

		return key;
	}

	private aad(purpose: string, entry: KeyEntry): Buffer {
		return Buffer.concat([Buffer.from([VERSION_V2]), entry.id, Buffer.from(purpose, 'utf-8')]);
	}
}
