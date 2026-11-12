// Type-level checks, compiled by `npm run typecheck` (tsconfig.check.json),
// never run. Each line is how a user writes it from the docs.
import { Kavik } from '../src/index';

// process.env.KAVIK_API_KEY is `string | undefined`; it must compile and the
// constructor throws at runtime when the key is missing.
declare const fromEnv: string | undefined;
export const fromDocs = () => new Kavik(fromEnv);
export const withOptions = () => new Kavik(fromEnv, { timeout: 30_000 });
export const asObject = () => new Kavik({ apiKey: 'eva_test' });

// Node types a request header as `string | string[] | undefined` and fetch's
// Headers.get() returns `string | null`. Both go in as they are; anything but a
// single string fails the check at runtime.
import { verifyWebhookSignature, parseWebhookEvent } from '../src/index';
declare const nodeHeader: string | string[] | undefined;
declare const fetchHeader: string | null;
export const fromNode = () => verifyWebhookSignature({ payload: '{}', signature: nodeHeader, secret: 's' });
export const fromFetch = () => parseWebhookEvent({ payload: '{}', signature: fetchHeader, secret: 's' });
