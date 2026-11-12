import { WebhookSignatureError } from './errors';
import type { VerifyWebhookOptions } from './types';

/**
 * Verify the HMAC-SHA256 signature of an incoming Kavik.email webhook.
 *
 * Uses the Web Crypto API: works in Node 20+, Deno, Bun, and browsers.
 *
 * @example
 * ```ts
 * const valid = await verifyWebhookSignature({
 *   payload: req.body,               // raw body string
 *   signature: req.headers['x-eva-signature'],
 *   secret: process.env.KAVIK_WEBHOOK_SECRET,
 * });
 * ```
 */
export async function verifyWebhookSignature(
  options: VerifyWebhookOptions,
): Promise<boolean> {
  const { payload, signature, secret } = options;
  // A request without the header (or with a repeated one) fails the check.
  if (typeof signature !== 'string') return false;

  const encoder = new TextEncoder();
  let payloadBytes: Uint8Array<ArrayBuffer>;
  if (typeof payload === 'string') {
    payloadBytes = encoder.encode(payload);
  } else if (payload instanceof ArrayBuffer) {
    payloadBytes = new Uint8Array(payload);
  } else {
    // A Node Buffer (express.raw) is usually a view into a larger shared
    // pool, so read only its own bytes.
    const view = payload as ArrayBufferView;
    payloadBytes = new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, payloadBytes);
  const expected = arrayBufferToHex(sig);

  return timingSafeEqual(expected, signature);
}

/**
 * Verify the signature and parse the webhook payload in one step.
 *
 * Throws {@link WebhookSignatureError} if the signature is invalid.
 *
 * @example
 * ```ts
 * import { parseWebhookEvent, BulkJobCompletedEvent } from 'kavik';
 *
 * const event = await parseWebhookEvent<BulkJobCompletedEvent>({
 *   payload: req.body,
 *   signature: req.headers['x-eva-signature'],
 *   secret: process.env.KAVIK_WEBHOOK_SECRET,
 * });
 * console.log(event.job_id, event.summary);
 * ```
 */
export async function parseWebhookEvent<T>(
  options: VerifyWebhookOptions,
): Promise<T> {
  const valid = await verifyWebhookSignature(options);
  if (!valid) {
    throw new WebhookSignatureError();
  }
  const body =
    typeof options.payload === 'string'
      ? options.payload
      : new TextDecoder().decode(options.payload as ArrayBufferView);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new WebhookSignatureError('Webhook payload is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new WebhookSignatureError('Webhook payload is not a JSON object');
  }

  if (!('event' in parsed) || typeof (parsed as Record<string, unknown>).event !== 'string') {
    throw new WebhookSignatureError('Webhook payload missing required "event" field');
  }

  return parsed as T;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
