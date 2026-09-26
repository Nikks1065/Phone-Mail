import crypto from 'crypto';

/**
 * Hash OTP codes before persistence so plaintext codes are never stored.
 */
export function hashOtp(phone: string, code: string): string {
  const secret = process.env.JWT_SECRET || 'phonemail_super_secret_buildathon_key_2026';
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

export function verifyOtpHash(phone: string, code: string, storedHash: string): boolean {
  const expected = hashOtp(phone, code);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === 'true') return true;
  if (process.env.DEMO_MODE === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}
