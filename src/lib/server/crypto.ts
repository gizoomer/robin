import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function keyFrom(b64: string | undefined): Buffer {
	if (!b64) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
	const key = Buffer.from(b64, 'base64');
	if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
	return key;
}

/** AES-256-GCM. Output: base64(iv[12] | tag[16] | ciphertext). */
export function encrypt(plain: string, keyB64: string | undefined): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', keyFrom(keyB64), iv);
	const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decrypt(payload: string, keyB64: string | undefined): string {
	const raw = Buffer.from(payload, 'base64');
	const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyB64), raw.subarray(0, 12));
	decipher.setAuthTag(raw.subarray(12, 28));
	return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Signed, tamper-proof OAuth `state` value: base64url(json).hmac */
export function signState(data: Record<string, string>, keyB64: string | undefined): string {
	const body = Buffer.from(JSON.stringify({ ...data, n: randomBytes(8).toString('hex'), t: Date.now() })).toString(
		'base64url'
	);
	const mac = createHmac('sha256', keyFrom(keyB64)).update(body).digest('base64url');
	return `${body}.${mac}`;
}

export function verifyState(
	state: string,
	keyB64: string | undefined,
	maxAgeMs = 15 * 60 * 1000
): Record<string, string> | null {
	const [body, mac] = state.split('.');
	if (!body || !mac) return null;
	const expected = createHmac('sha256', keyFrom(keyB64)).update(body).digest();
	const given = Buffer.from(mac, 'base64url');
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
	const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
	if (typeof data.t !== 'number' || Date.now() - data.t > maxAgeMs) return null;
	return data;
}
