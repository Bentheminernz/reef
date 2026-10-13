import { customType } from 'drizzle-orm/sqlite-core';
import { EncryptionUtil, encryptionPurpose } from '$lib/server/utils/EncryptionUtil';

const encryption = new EncryptionUtil();

export function encryptedJson<T>(table: string) {
	return (column: string) => {
		const purpose = encryptionPurpose(table, column);

		return customType<{ data: T; driverData: Buffer }>({
			dataType() {
				return 'blob';
			},
			toDriver(value: T): Buffer {
				return encryption.encryptJson(value, purpose);
			},
			fromDriver(value: Buffer): T {
				return encryption.decryptJson<T>(value, purpose);
			}
		})(column);
	};
}

export function encryptedString(table: string) {
	return (column: string) => {
		const purpose = encryptionPurpose(table, column);

		return customType<{ data: string; driverData: Buffer }>({
			dataType() {
				return 'blob';
			},
			toDriver(value: string): Buffer {
				return encryption.encryptString(value, purpose);
			},
			fromDriver(value: Buffer): string {
				return encryption.decryptString(value, purpose);
			}
		})(column);
	};
}
