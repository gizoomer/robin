import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, signState, verifyState } from './crypto';

const key = randomBytes(32).toString('base64');

describe('token encryption', () => {
	it('round-trips', () => {
		const enc = encrypt('ya29.secret-token', key);
		expect(enc).not.toContain('secret');
		expect(decrypt(enc, key)).toBe('ya29.secret-token');
	});

	it('rejects a different key', () => {
		const enc = encrypt('x', key);
		expect(() => decrypt(enc, randomBytes(32).toString('base64'))).toThrow();
	});
});

describe('oauth state', () => {
	it('verifies its own signature', () => {
		const s = signState({ org: 'abc', user: 'u1' }, key);
		expect(verifyState(s, key)).toMatchObject({ org: 'abc', user: 'u1' });
	});

	it('rejects tampering', () => {
		const s = signState({ org: 'abc' }, key);
		const [body, mac] = s.split('.');
		const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), org: 'evil' }))
			.toString('base64url');
		expect(verifyState(`${forged}.${mac}`, key)).toBeNull();
	});

	it('expires', () => {
		const s = signState({ org: 'abc' }, key);
		expect(verifyState(s, key, -1)).toBeNull();
	});
});
