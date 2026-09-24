# MYCMO developer handoff

Everything a developer needs to install, run and deploy MYCMO, plus the accounts the business
owner must create at Google, Meta and the other platforms.

## 1. Read this first: what is built vs. what the demo shows

The clickable demo (`demo/mycmo-demo.html`) is the **approved design target**. The SvelteKit app
implements the engine behind it but not every screen yet.

| Area | In the app | Only in the demo (still to build) |
|---|---|---|
| Login: email link, Google, Microsoft | Yes | |
| Clients, roles, row-level security | Yes (roles are named `owner`/`rep`/`viewer` in the database) | Rename "owner" to "Admin" in the UI |
| Client dashboard, goals, KPIs, pipeline, leads, huddle | Yes | Consulting-style visual redesign |
| Team invites, KPI and goal setup | Yes | Hierarchy view on the team page |
| Google (GA4, Search Console, YouTube), Meta, Google Ads, Meta Ads, WhatConverts connectors | Yes | |
| Nightly data sync | Yes | |
| Partner API (outside firms send data in) | Yes | |
| AI assistant (Claude / ChatGPT) | Yes | |
| Super-admin **Accounts** table (plans, fees, renewal, billed-to), star/"My view", account switcher, "View as" | No | Yes |
| Plans and billing | No (no billing tables, no Stripe) | Shown with placeholder prices |
| MCP server / partner MCP | No | Shown as "Planned" |

Suggested first task: build the demo's Accounts screen and plan/billing fields on top of the
existing `organizations` table, then restyle the client dashboard to match the demo.

## 2. Tech stack

- **Frontend + server:** SvelteKit 2 with Svelte 5 (runes), TypeScript, Tailwind CSS 4.
  One codebase: pages and API routes run on the same server.
- **Database + login:** Supabase (hosted Postgres, Supabase Auth, row-level security).
- **Hosting:** set up for **Vercel** (`@sveltejs/adapter-vercel`, nightly job in `vercel.json`).
  Any Node host works by switching to `@sveltejs/adapter-node` in `svelte.config.js` and
  scheduling the nightly job there instead (see section 6).
- **Node:** 22 LTS (Vite requires 20.19+ or 22.12+).
- **No other backend.** There is no separate API server to deploy.

## 3. Get the code

```bash
git clone -b claude/elegant-cray-pbf6gx https://github.com/gizoomer/robin.git mycmo
cd mycmo
npm install
```

Try it with no accounts at all (sample data, 20 clients):

```bash
npm run build
DEMO_MODE=true npx vite preview      # open http://localhost:4173
```

## 4. Local setup against a real database

1. Create a Supabase project (free tier is fine for development).
2. In the Supabase SQL editor, run every file in `supabase/migrations/` **in number order**.
3. `cp .env.example .env` and fill in the Supabase URL, anon key and service role key
   (Project Settings > API). Generate `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.
4. Supabase > Authentication > URL Configuration: add `http://localhost:5173/auth/callback`.
5. Invite the first user (Authentication > Users > Invite), then make them super admin:
   `update profiles set is_agency_staff = true where email = 'owner@yourcompany.com';`
6. `npm run dev` and open http://localhost:5173

Checks before any deploy:

```bash
npm run check   # TypeScript + Svelte
npm test        # unit tests
npm run build
```

Database permission tests: see "Testing the database" in `README.md`.

## 5. Environment variables

All listed in `.env.example`. Set the same values in the hosting provider.

| Variable | Required | What it is |
|---|---|---|
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only. Never expose to the browser |
| `PUBLIC_APP_URL` | Yes | e.g. `https://app.yourdomain.com` (used to build sign-in return URLs) |
| `TOKEN_ENCRYPTION_KEY` | Yes | Encrypts stored Google/Meta/WhatConverts tokens. **Losing it means every client must reconnect.** Keep it in a password manager |
| `CRON_SECRET` | Yes | Random string; protects the nightly sync URL |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Google data | Section 7 |
| `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION` | For Meta data | Section 7 |
| `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_API_VERSION` | For Google Ads | Section 7 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | For Claude answers | console.anthropic.com |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | For ChatGPT answers | platform.openai.com; set the model your account should use |
| `DEMO_MODE` | No | Must be `false` (or unset) in production |

## 6. Hosting

**Recommended: Vercel + Supabase.**

1. Import the GitHub repo into Vercel; framework is detected as SvelteKit.
2. Add every environment variable from section 5.
3. Add the custom domain (e.g. `app.yourdomain.com`) and point DNS as Vercel instructs.
4. The nightly sync runs from `vercel.json` (06:17 UTC). Vercel sends `Authorization: Bearer $CRON_SECRET`.
5. In Supabase > Authentication > URL Configuration, set the Site URL to the production domain and
   add `https://app.yourdomain.com/auth/callback`.
6. Use a Vercel plan that allows commercial use, and check its function timeout: the sync endpoint
   loops through every connected account in one request, so with many clients it may need a longer
   timeout or to be split into batches.

**Other hosts (Render, Railway, Fly.io, a VPS):** install `@sveltejs/adapter-node`, set it in
`svelte.config.js`, run `node build`, and call `GET /api/sync` with the `CRON_SECRET` bearer header
once a day from that host's scheduler.

## 7. Accounts the business owner must create

These belong to the company, not to the developer. Create them under a company Google account
and a Meta Business account, and add the developer as a user.

### Sign-in with Google and Microsoft (Supabase > Authentication > Providers)
- **Google:** Google Cloud OAuth client (Web), redirect URI
  `https://<project>.supabase.co/auth/v1/callback`. Only asks for name and email, so no Google review needed.
- **Microsoft ("Azure" in Supabase):** Microsoft Entra ID app registration for "any organizational
  directory and personal Microsoft accounts", same Supabase redirect URI. Tenant: `common`.

### Google data (Analytics, Search Console, YouTube)
1. Google Cloud project; enable: Google Analytics Data API, Google Analytics Admin API,
   Google Search Console API, YouTube Data API v3, YouTube Analytics API.
2. OAuth consent screen (External), with privacy policy and terms URLs on your domain.
3. OAuth client (Web) with redirect URIs:
   `https://app.yourdomain.com/api/integrations/google/callback` and `.../google_ads/callback`.
4. **Submit for Google verification.** These are sensitive read-only scopes. Until verified, only
   up to 100 listed test users can connect and their connections expire after 7 days. Needs a
   homepage, privacy policy and a short demo video. Start this early; it takes weeks.

### Google Ads
- A Google Ads **manager (MCC) account** with the clients' ad accounts linked under it.
- **Developer token** from the MCC's API Center. Test tokens only see test accounts; apply for
  **Basic Access** to read real client data.
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = the MCC id (digits only).

### Meta (Facebook, Instagram, Meta Ads)
1. Meta for Developers: create a **Business** app, add Facebook Login for Business.
2. Valid OAuth redirect URIs: `https://app.yourdomain.com/api/integrations/meta/callback` and `.../meta_ads/callback`.
3. **Business Verification** for the company, then **App Review** for Advanced Access to:
   `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`,
   `instagram_manage_insights`, `business_management`, `ads_read`. Takes weeks.
4. Meta tokens last about 60 days; clients reconnect from the Connections page when prompted.

### WhatConverts
- Nothing to register. Each client (or the agency, with a master key) pastes an API token and
  secret on the client's Connections page. Test with one real key first: the connector was built
  from WhatConverts' public docs and has not yet run against live data.

### AI assistant
- Anthropic API key (Claude) and/or OpenAI API key plus model name (ChatGPT). Set a monthly spend
  limit in each provider's console. Clients can switch the assistant off.

## 8. Where things live in the code

| Path | What |
|---|---|
| `supabase/migrations/` | Database schema and row-level security (source of truth for permissions) |
| `src/lib/server/connectors/` | One file per platform (Google, Meta, Google Ads, Meta Ads, WhatConverts) |
| `src/lib/server/integrations.ts` | Token storage, refresh and the sync job |
| `src/routes/api/sync/` | Nightly sync endpoint |
| `src/routes/api/v1/partner/` | Partner API |
| `src/lib/server/ai.ts`, `src/routes/app/[org]/ask/` | AI assistant |
| `src/routes/app/` | All signed-in pages |
| `src/lib/metrics.ts`, `src/lib/providers.ts` | Metric catalog and platform list |
| `demo/mycmo-demo.html` | Clickable design target |

Adding a platform: new file in `src/lib/server/connectors/`, register it in `index.ts`, add the
enum value in a new migration, add its metrics in `metrics.ts` and its entry in `providers.ts`.

## 9. Security notes

- Never commit `.env`. The service role key and encryption key are the crown jewels.
- Row-level security is on for every table; client users only ever see their own business.
  Keep new tables behind the same `can_view_org` / `can_manage_org` policies.
- `integration_secrets` has no client-facing policies by design; only server code reads it.
