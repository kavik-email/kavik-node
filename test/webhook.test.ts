import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { verifyWebhookSignature } from '../src/webhook.ts';

const secret = 'whsec_test';
const body = '{"event":"job.completed","job_id":"j1"}';
const signature = createHmac('sha256', secret).update(body).digest('hex');

test('a string payload with the right signature verifies', async () => {
  assert.equal(await verifyWebhookSignature({ payload: body, signature, secret }), true);
});

test('a view into a larger buffer verifies (express.raw gives a pooled Buffer)', async () => {
  const bytes = new TextEncoder().encode(body);
  const pool = new Uint8Array(bytes.length + 32);
  pool.set(bytes, 16);
  const view = pool.subarray(16, 16 + bytes.length);
  assert.equal(await verifyWebhookSignature({ payload: view, signature, secret }), true);
  const buf = Buffer.concat([Buffer.from(body)]);
  assert.equal(await verifyWebhookSignature({ payload: buf, signature, secret }), true);
});

test('a missing signature header is a failed check, not a crash', async () => {
  assert.equal(await verifyWebhookSignature({ payload: body, signature: undefined, secret }), false);
  // fetch's Headers.get() gives null for a missing header.
  assert.equal(await verifyWebhookSignature({ payload: body, signature: null, secret }), false);
});

test('a repeated signature header fails the check, even when one copy is right', async () => {
  assert.equal(await verifyWebhookSignature({ payload: body, signature: [signature, signature], secret }), false);
});
