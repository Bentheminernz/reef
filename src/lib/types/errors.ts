import { m } from "$lib/paraglide/messages";
import { error, fail } from "@sveltejs/kit";

export const ERRORS = {
	authentication_required: 401,
	invalid_request: 400,
    znca_error: 502,
    discord_error_generic: 502,
    discord_error_disabled: 403,
	discord_error_max_links: 403,

	nintendo_link: 400,
	invalid_link: 400,
	sign_up_disabled: 403,
	switch_not_linked: 403,

	passkey_start_failed: 400,
	passkey_failed: 400,
	passkey_cancelled: 400,
	passkey_insecure: 400,

	network: 503,
	unknown: 500
} as const;

export type ErrorCode = keyof typeof ERRORS;

export class ReefError extends Error {
	readonly code: ErrorCode;

	constructor(code: ErrorCode, options?: ErrorOptions) {
		super(code, options);
		this.name = 'AppError';
		this.code = code;
	}

	get status() {
		return ERRORS[this.code];
	}

	static from(value: unknown): ReefError {
		if (value instanceof ReefError) return value;
		if (typeof value === 'string' && value in ERRORS) return new ReefError(value as ErrorCode);
		if (value instanceof TypeError) return new ReefError('network', { cause: value });
		return new ReefError('unknown', { cause: value });
	}

	static async fromResponse(response: Response): Promise<ReefError> {
		const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
		return ReefError.from(body?.message);
	}
}


const messages: Record<ErrorCode, () => string> = {
	authentication_required: () => m.common_error_auth_required(),
	invalid_request: () => m.common_error_invalid_request(),
    znca_error: () => m.common_error_znca(),
    discord_error_generic: () => m.common_error_discord_generic(),
    discord_error_disabled: () => m.common_error_discord_disabled(),
    discord_error_max_links: () => m.common_error_discord_max_links(),
	nintendo_link: () => m.nintendo_login_error_invalid_link(),
	invalid_link: () => m.nintendo_login_error_link_mismatch(),
	sign_up_disabled: () => m.common_error_sign_up_disabled(),
	switch_not_linked: () => m.common_error_switch_not_linked(),
	passkey_start_failed: () => m.login_error_passkey_start_failed(),
	passkey_failed: () => m.login_error_passkey_failed(),
	passkey_cancelled: () => m.login_error_passkey_cancelled(),
	passkey_insecure: () => m.login_error_passkey_insecure(),
	network: () => m.common_error_network(),
	unknown: () => m.common_error_generic()
};

export const errorMessage = (error: unknown) => messages[ReefError.from(error).code]();

export const httpError = (code: ErrorCode) => error(ERRORS[code], code);

export const failWith = <T extends Record<string, unknown> = Record<never, never>>(
	code: ErrorCode,
	data?: T
) => fail(ERRORS[code], { ...(data ?? ({} as T)), message: code });
