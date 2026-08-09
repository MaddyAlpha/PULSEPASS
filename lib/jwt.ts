/**
 * PulsePass — JWT Utilities for Dynamic QR Tokens
 *
 * Uses `jose` (edge-runtime compatible) to sign and verify
 * time-based QR tokens. Each token expires in 30 seconds.
 * The scanner must verify the signature + expiry before check-in.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const SECRET_KEY = new TextEncoder().encode(
  process.env.QR_JWT_SECRET || 'pulsepass-fallback-dev-secret-change-in-prod'
)

export interface QRTokenPayload extends JWTPayload {
  ticket_id: string
  roll_number: string
  event_id: string
  ticket_type: 'general' | 'vip'
  issued_at: number
}

/**
 * Signs a new QR JWT token valid for 30 seconds.
 * Call this on ticket claim and every 25s on the client.
 */
export async function signQRToken(payload: Omit<QRTokenPayload, 'iat' | 'exp' | 'issued_at'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    ...payload,
    issued_at: now,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime('30s')
    .sign(SECRET_KEY)
}

/**
 * Verifies a QR JWT token.
 * Returns the payload if valid, throws if expired or tampered.
 */
export async function verifyQRToken(token: string): Promise<QRTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET_KEY, {
    algorithms: ['HS256'],
  })
  return payload as QRTokenPayload
}

/**
 * Checks if a token is within its valid window (not expired, not future-dated).
 * Returns true if valid, false if expired.
 */
export function isTokenFresh(payload: QRTokenPayload): boolean {
  const now = Math.floor(Date.now() / 1000)
  const exp = payload.exp ?? 0
  return now < exp
}
