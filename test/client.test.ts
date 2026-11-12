import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Kavik } from '../src/client.ts';
import { KavikError, NotFoundError } from '../src/errors.ts';

/** A fetch that answers every call with `status`/`body` and records each URL. */
function recorder(status = 200, body: unknown = { data: [] }) {
  const urls: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  return { fetch, urls };
}

test('a bare key talks to api.kavik.email', async () => {
  const r = recorder();
  await new Kavik('eva_test', { fetch: r.fetch }).listBulkJobs();
  assert.equal(r.urls[0], 'https://api.kavik.email/api/v1/verify/async');
});

test('an options object and a custom host still work', async () => {
  const r = recorder();
  await new Kavik({
    apiKey: 'eva_test',
    baseUrl: 'https://example.test/',
    fetch: r.fetch,
  }).listBulkJobs();
  assert.equal(r.urls[0], 'https://example.test/api/v1/verify/async');
});

test('the API docs base URL with /api/v1 is accepted', async () => {
  const r = recorder();
  await new Kavik('eva_test', {
    baseUrl: 'https://api.kavik.email/api/v1/',
    fetch: r.fetch,
  }).listBulkJobs();
  assert.equal(r.urls[0], 'https://api.kavik.email/api/v1/verify/async');
});

test('a missing key throws', () => {
  assert.throws(() => new Kavik(''), /apiKey is required/);
  assert.throws(() => new Kavik({ apiKey: '' }), /apiKey is required/);
  assert.throws(() => new Kavik(undefined), /apiKey is required/);
});

test('API errors are KavikError', async () => {
  const r = recorder(404, { error: 'not found', code: 'NOT_FOUND' });
  await assert.rejects(
    new Kavik('eva_test', { fetch: r.fetch, maxRetries: 0 }).getBulkJob('x'),
    (e: unknown) => e instanceof NotFoundError && e instanceof KavikError,
  );
});
