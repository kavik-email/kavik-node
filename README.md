# kavikemail

Official JavaScript and TypeScript SDK for the **Kavik.email** email verification API.

Zero dependencies. Works with Node.js 20+, Deno, Bun, and modern browsers.

## Installation

```bash
npm install kavikemail
```

## Quick Start

```typescript
import { Kavik } from 'kavikemail';

const kavik = new Kavik('eva_...');

const { data, rateLimit } = await kavik.verify('user@example.com');

console.log(data.score);        // 85
console.log(data.risk);         // "safe"
console.log(data.smtp_check);   // "deliverable"
console.log(data.is_disposable); // false
console.log(rateLimit.remaining); // 199
```

## Features

- Single email verification
- Batch verification (up to 100 emails)
- Async bulk file upload (CSV/XLSX) with polling
- Domain deliverability reports (SPF/DKIM/DMARC/blacklists)
- Webhook signature verification (HMAC-SHA256)
- Auto-retry with exponential backoff on 429/5xx (a used-up daily or monthly allowance is not retried)
- Rate limit info on every response
- Full TypeScript types

## API Reference

### Constructor

```typescript
const kavik = new Kavik({
  apiKey: 'eva_...',           // Required
  baseUrl: 'https://...',     // Default: 'https://api.kavik.email'
  timeout: 100_000,           // Request timeout in ms (default: 100s)
  maxRetries: 3,              // Retries on 429/5xx (default: 3)
  retryDelay: 1000,           // Base retry delay in ms (default: 1s)
});

// Or pass the key first and the rest as options:
const kavik = new Kavik('eva_...', { timeout: 30_000 });
```

### Single Verification

```typescript
const { data } = await kavik.verify('user@gmail.com');

console.log(data.email);                  // "user@gmail.com"
console.log(data.score);                  // 0-100
console.log(data.risk);                   // "safe" | "risky" | "catchall" | "invalid" | "unknown"
console.log(data.smtp_check);             // "deliverable" | "undeliverable" | "risky" | "unknown"
console.log(data.is_disposable);          // false
console.log(data.is_role_account);        // false
console.log(data.is_catch_all);           // false
console.log(data.is_free_provider);       // true
console.log(data.spam_trap_risk);         // "low" | "medium" | "high"
console.log(data.suggested_correction);   // null or "gmail.com"
console.log(data.mx_records);             // ["aspmx.l.google.com", ...]
```

### Batch Verification

```typescript
const { data } = await kavik.verifyBatch([
  'user1@gmail.com',
  'user2@company.com',
  'fake@disposable.xyz',
]);

console.log(data.total);   // 3
for (const result of data.results) {
  console.log(result.email, result.risk, result.score);
}
```

### Bulk File Upload + Polling

```typescript
import { readFileSync } from 'fs';

const csvFile = readFileSync('emails.csv');

// Upload the file
const { data: job } = await kavik.uploadBulk(csvFile, {
  webhookUrl: 'https://myapp.com/webhook/kavik', // optional
  filename: 'my-list.csv',                     // optional
});

console.log(job.id);     // "abc-123"
console.log(job.status); // "pending"

// Poll until complete
const { data: completed } = await kavik.waitForBulkJob(job.id, {
  interval: 3000,  // poll every 3s (default: 5s)
  timeout: 300_000, // max wait 5min (default: 10min)
  onProgress: (j) => {
    console.log(`${j.completed_count}/${j.total_count} processed`);
  },
});

// Download results
const { data: results } = await kavik.getBulkJobResults(completed.id);
for (const r of results) {
  console.log(r.email, r.risk, r.score);
}

// Or download as CSV
const csv = await kavik.getBulkJobResults(completed.id, 'csv');
writeFileSync('results.csv', csv);
```

### Domain Deliverability

```typescript
const { data } = await kavik.getDomainDeliverability('example.com');

console.log(data.score);                      // 85
console.log(data.grade);                      // "A"
console.log(data.authentication?.spf.found);  // true
console.log(data.authentication?.dkim.found); // true
console.log(data.authentication?.dmarc.policy); // "reject"
console.log(data.blacklist?.listed);          // false
```

### Bulk Job Management

```typescript
// List all jobs
const { data: jobs } = await kavik.listBulkJobs();

// Get specific job status
const { data: job } = await kavik.getBulkJob('job-id-123');
```

## Webhook Verification

Verify incoming webhook signatures without instantiating the client:

```typescript
import { verifyWebhookSignature, parseWebhookEvent } from 'kavikemail';
import type { BulkJobCompletedEvent } from 'kavikemail';

// Option 1: Verify only
const isValid = await verifyWebhookSignature({
  payload: rawBody,
  signature: req.headers['x-eva-signature'],
  secret: process.env.KAVIK_WEBHOOK_SECRET,
});

// Option 2: Verify + parse in one step
const event = await parseWebhookEvent<BulkJobCompletedEvent>({
  payload: rawBody,
  signature: req.headers['x-eva-signature'],
  secret: process.env.KAVIK_WEBHOOK_SECRET,
});

console.log(event.job_id);
console.log(event.summary); // { safe: 800, risky: 100, catchall: 50, invalid: 50, unknown: 12 }
```

### Express.js Example

```typescript
import express from 'express';
import { parseWebhookEvent } from 'kavikemail';
import type { BulkJobCompletedEvent } from 'kavikemail';

const app = express();

app.post('/webhook/kavik', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const event = await parseWebhookEvent<BulkJobCompletedEvent>({
      payload: req.body,
      signature: req.headers['x-eva-signature'] as string,
      secret: process.env.KAVIK_WEBHOOK_SECRET!,
    });

    console.log(`Job ${event.job_id} completed:`, event.summary);
    res.sendStatus(200);
  } catch (err) {
    console.error('Invalid webhook:', err);
    res.sendStatus(401);
  }
});
```

## Error Handling

All API errors are thrown as typed error classes:

```typescript
import {
  Kavik,
  KavikError,
  RateLimitError,
  QuotaExceededError,
  AuthenticationError,
  NotFoundError,
} from 'kavikemail';

const kavik = new Kavik('eva_...');

try {
  const { data } = await kavik.verify('test@example.com');
} catch (err) {
  if (err instanceof RateLimitError) {
    // Per-minute rate limit hit: wait and retry
    console.log(`Rate limited. Retry after ${err.retryAfter}s`);
    console.log(`Remaining: ${err.rateLimit?.remaining}`);
  } else if (err instanceof QuotaExceededError) {
    // Monthly quota exhausted, no PAYG credits left
    console.log('Quota exceeded. Purchase credit packs to continue.');
  } else if (err instanceof KavikError && err.code === 'PAID_PLAN_REQUIRED') {
    // Free account without credits: API access needs a plan or a credit
    // pack. Its 300 free checks run in the dashboard.
    console.log('Pick a plan or a credit pack to use the API.');
  } else if (err instanceof AuthenticationError) {
    // Invalid or missing API key
    console.log('Check your API key');
  } else if (err instanceof NotFoundError) {
    // Resource not found (e.g., invalid bulk job ID)
    console.log('Not found');
  } else if (err instanceof KavikError) {
    // Other API error
    console.log(err.message, err.code, err.status);
  }
}
```

## Rate Limit Info

Every response includes rate limit data:

```typescript
const { data, rateLimit } = await kavik.verify('user@example.com');

console.log(rateLimit.limit);             // 200 (per-minute limit)
console.log(rateLimit.remaining);         // 199
console.log(rateLimit.reset);             // Date object
console.log(rateLimit.creditsRemaining);  // null or number (PAYG credits)
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | none | **Required.** Your Kavik.email API key (starts with `eva_`). |
| `baseUrl` | `string` | `https://api.kavik.email` | API base URL. |
| `timeout` | `number` | `100000` | Request timeout (ms). A check can take up to 90 s when the mail server holds its reply. |
| `maxRetries` | `number` | `3` | Max retries on 429/5xx errors. `DAILY_LIMIT` and `QUOTA_EXCEEDED` are never retried, and no single wait is longer than 60 s. |
| `retryDelay` | `number` | `1000` | Base delay (ms) for exponential backoff. |
| `fetch` | `function` | `globalThis.fetch` | Custom fetch implementation. |

## Runtime Support

| Runtime | Version | Notes |
|---------|---------|-------|
| Node.js | >= 18 | Native `fetch` and `crypto.subtle` |
| Deno | >= 1.28 | Full support |
| Bun | >= 1.0 | Full support |
| Browsers | Modern | Chrome 63+, Firefox 57+, Safari 11.1+ |

## Changelog

See [CHANGELOG.md](https://github.com/kavik-email/kavik-node/blob/main/CHANGELOG.md).

## License

MIT
