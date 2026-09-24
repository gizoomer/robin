import { google } from './google';
import { googleAds } from './googleAds';
import { meta } from './meta';
import { metaAds } from './metaAds';
import { whatconverts } from './whatconverts';
import type { Connector } from './types';

// To add TikTok, LinkedIn, Google Business Profile, etc.: implement Connector in a new file,
// register it here, add the enum value in SQL, add its metrics to $lib/metrics.ts,
// and set `available: true` for it in $lib/providers.ts.
export const connectors = { google, meta, google_ads: googleAds, meta_ads: metaAds, whatconverts } as const satisfies Record<
	string,
	Connector<any, any>
>;
export type ProviderId = keyof typeof connectors;

export function isProvider(p: string): p is ProviderId {
	return p in connectors;
}
