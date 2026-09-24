import { google } from './google';
import { meta } from './meta';
import type { Connector } from './types';

// To add TikTok, LinkedIn, Google Ads, etc.: implement Connector in a new file,
// register it here, add the enum value in SQL, and add its metrics to $lib/metrics.ts.
export const connectors = { google, meta } as const satisfies Record<string, Connector<any, any>>;
export type ProviderId = keyof typeof connectors;

export function isProvider(p: string): p is ProviderId {
	return p in connectors;
}
