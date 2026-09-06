# Shared usage backend

The schema, resource registry, expiry job and three statistics functions are installed, with collection disabled. Hosted acceptance must finish before activation. The owner's separate setup package records installation history and acceptance evidence; inspect that history before applying migrations again. The checked-in function settings match the deployed anonymous ingest/public endpoints and authenticated owner endpoint.

## Contract

The function base is the configured Supabase service origin plus /functions/v1/.

- POST usage-ingest: exactly source (education or play), resource_id (64 lowercase hex), event_type (lesson_open, download_request or game_launch), event_nonce (a new UUIDv4 for one event).
- 202 {ok:true,counted:true|false}. Replaying the same event nonce within ten minutes returns counted:false. A different event/resource using that nonce returns 409. Source/resource caps return 429. Backend failure returns 503; there is no fallback count.
- GET usage-public?source=education (or play), optionally ids=comma-separated IDs, at most 50. It returns schema, source, enabled, measured_since, as_of, windows and resources.
- windows.last30days and windows.alltime each return from, to, totals (lesson_open, download_request, game_launch) and top (lessons, packs, games).
- Top rows contain resource_id, title, route and count. Only registry kind=pack enters top.packs; individual worksheets/files remain downloadable resources. All download events still contribute to download totals.
- Requested resource rows contain resource_id, event_type, last30days and alltime.
- GET owner-usage?source=education|play requires an existing Auth bearer token plus a server-maintained owner UUID. Its response adds geography:{enabled:false,status:"not_collected",rows:[]}. Anonymous, ordinary authenticated and anonymous-Auth accounts are denied.

Education-origin catalogue game links can emit play-source game_launch events. Play-origin pages cannot emit education-source events. No visitor identifier joins these events. Origins are the canonical madebymatt.uk and madebymatt-play.uk hosts and their www aliases.

Collection never consumes query strings, referrers, search/audience/pupil/account/gameplay values, IPs, user agents or client country. Clients must use credentials:omit and referrerPolicy:no-referrer and must send no Auth token to usage-ingest. Consent/preference handling and in-page click debounce belong to the frontend. An individual game launch or download request is an attempted opening, not proof the resource finished loading.

## Database and access

The migration was named using Supabase CLI migration new mbm_usage. The seven tables live in a private schema with RLS, no public policies and no browser/direct service-role table grants. Public summaries expose only aggregates. The record RPC is a tightly constrained SECURITY DEFINER function executable only by service_role, used by the anonymous Edge collector with its built-in server credential. There is no general-purpose write or SQL RPC. The owner summary checks auth.uid() against a private UUID allowlist and denies anonymous Auth claims. It ignores user-editable metadata. Mutation functions are VOLATILE; read shaping is STABLE.

The SQL owner controls catalogue, source enable flags, caps and owner membership. Application roles cannot grant themselves access. The collector cannot edit totals arbitrarily or accept client increments.

All-time counters persist independently of the rolling daily buckets. The last-30-day window is the current UTC date plus its preceding 29 dates, through as_of, rather than an exact moving 720-hour window. measured_since remains null until the first accepted, committed event for that source. A frontend publish, migration, empty registry import or failed ingestion does not start measurement.

Ingestion serializes transactions per source, preventing replay races and lost increments. Default bounds are 600 source events/minute and 120 per resource/event/minute. These are storage/abuse bounds, not a claim to stop all bots; anonymous traffic can be forged.

Event nonces expire logically after ten minutes. The owner-scheduled expiry job removes expired nonce rows and transient quota buckets every five minutes, including idle periods, and prunes daily buckets older than 31 calendar dates. Do not claim the storage schedule is guaranteed during a provider outage or pause. All-time aggregates are unaffected. No country table exists; geographic collection remains off.

## Exact setup order

1. Verify the legitimate Supabase management/database connection with a harmless metadata SELECT. The earlier connection failure was resolved; do not reset production credentials or replay installed migrations blindly.
2. Run local tests below and have the owning agent copy only the prepared repo files. Review and apply the migration through the normal authorized Supabase migration path.
3. Obtain the fresh reviewed registry from the actual assembled destinations. Run:
   python domain-split/analytics-backend/prepare_registry.py --registry <reviewed-registry.json> --output <reviewed-registry.sql>
   Review/apply that SQL as database owner. It inserts metadata only. It rejects mismatched IDs, source/event/kind mismatches, duplicate routes and malformed aliases. IDs are SHA256(source + newline + canonical decoded path), or retain a previous route through an explicit alias. Existing counts are never reset or deleted by registry refresh.
4. Enable Supabase Cron and apply setup_retention.sql. Verify a successful run of precisely mbm-usage-expiry. Supabase documents the supported schedule and calls at https://supabase.com/docs/guides/cron/quickstart.
5. Identify the exact existing verified owner Auth UUID. Set the session parameter shown in grant_owner.sql, then run that file as database owner. Do not expose user credentials, authorize arbitrary authenticated users or choose the first database account.
6. Merge edge-config.toml sections into the owning repo supabase/config.toml. Deploy usage-ingest, usage-public and owner-usage. Do not deploy usage-shared as a standalone endpoint; it is a local module bundled by the others. No custom secret is needed beyond the existing project's built-in Supabase keys. Service credentials remain inside Edge execution.
7. Perform genuine provider checks with disposable explicitly marked QA resources in an isolated test source/database, or document any real owner-triggered test event as actual recorded activity. Never quietly insert synthetic activity into production history. Verify anonymous/direct write denial, ordinary-user owner denial, correct owner read, replay, caps, no request payload leakage and public empty state.
8. Review notices, explicit frontend privacy control, current provider log disclosures and client disabled states. Keep geography off. Run activate_after_acceptance.sql only after the gates pass; then the owning frontend integrator can enable its public usage configuration. No event is created by activation.
9. Keep an aggregate-only export/recovery procedure for real all-time totals. Free Supabase does not promise the same backup availability as paid plans. Disabling collection simply sets sources.enabled=false and frontend enabled=false; preserve historical counts and keep the expiry job running.

## Verification

Use Node 22.18+ (tested Node 24) and npm ci, then npm test in this directory. The pinned PGlite dependency runs genuine PostgreSQL 18.3 in a disposable local WASM database; tests create Supabase role/Auth stubs and execute the actual migration. The hosted target is PostgreSQL 17, so final hosted permission and actual concurrent multi-connection checks remain required. PGlite serializes concurrent promises on one connection: the test explicitly does not present that as multi-connection load proof.

Tests cover zero state/start dates, private RLS/grants, transactional replay/conflicts, invalid source/event/IDs, owner/non-owner/anonymous access, rate rollback, submitted-write counts, UTC boundaries, all-time retention, expiry, deterministic top ten, stable-ID metadata changes, exact HTTP input/privacy boundaries, payload limits and unavailable backend behavior. HTTP unit tests inject a transport; they do not claim provider acceptance.

Provider transport still sees the network requests and may keep IP/header logs independently of these application tables. Current Supabase Free API/database log retention is one day, and function/CDN details must be checked against actual deployment. This code does not claim to remove provider logs or establish blanket legal compliance. See the separately prepared ICO/provider audit.
