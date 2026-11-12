# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.3] - 2026-11-12

### Changed

- Source comments, which the source maps carry, use plain punctuation. The
  code is the same as 1.0.2.

## [1.0.2] - 2026-11-12

### Fixed

- `verifyWebhookSignature` and `parseWebhookEvent` take the signature header
  as your framework gives it (`string | string[] | null | undefined`), so
  `req.headers['x-eva-signature']` compiles without a cast. A missing or
  repeated header still fails the check.
- README samples compile as written (`writeFileSync` import, webhook secret).

## [1.0.1] - 2026-11-12

### Changed

- Releases are published from GitHub Actions with npm trusted publishing and
  carry provenance. The code is the same as 1.0.0.

## [1.0.0] - 2026-11-12

First release.

- `Kavik` client for single and batch checks, bulk jobs (upload a CSV or XLSX
  file, check status, fetch results as JSON or CSV, wait until done) and
  domain deliverability reports.
- Retries rate-limited and server errors with exponential backoff. A used-up
  daily or monthly allowance is never retried.
- `verifyWebhookSignature` and `parseWebhookEvent` for signed webhooks.
- Typed errors: `KavikError`, `RateLimitError`, `QuotaExceededError`,
  `DailyLimitError`, `AuthenticationError`, `NotFoundError`,
  `WebhookSignatureError`.
