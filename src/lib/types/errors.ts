class PasskeyError extends Error {
	code: 'start_failed' | 'failed';

	constructor(code: 'start_failed' | 'failed') {
		super(code);
		this.code = code;
	}
}

class SignUpDisabledError extends Error {
	constructor() {
		super('Sign ups are disabled');
		this.name = 'SignUpDisabledError';
	}
}

class SignUpLimitReached extends Error {
	constructor() {
		super('Maximum amount of users has been reached');
		this.name = 'SignUpLimitReached';
	}
}

class NintendoSwitchNotLinkedError extends Error {
	constructor() {
		super("This account isn't linked to a Nintendo Switch console.");
		this.name = 'NintendoSwitchNotLinkedError';
	}
}

export { PasskeyError, SignUpDisabledError, SignUpLimitReached, NintendoSwitchNotLinkedError };
