// No visitor data, IP-derived identifiers, request logging, or browser secrets.
export type Mode = "ingest" | "public" | "owner";
export type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch };
type Source = "education" | "play";
const EDUCATION = new Set(["https://madebymatt.uk", "https://www.madebymatt.uk"]);
const PLAY = new Set([...EDUCATION, "https://madebymatt-play.uk", "https://www.madebymatt-play.uk"]);
const ID = /^[0-9a-f]{64}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EVENTS = new Set(["lesson_open", "download_request", "game_launch"]);
const MAX_BODY = 512;

function response(status: number, body: unknown, origin: string | null, mode: Mode, extra: Record<string,string> = {}) {
  const headers: Record<string,string> = {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "Vary": "Origin", "X-Content-Type-Options": "nosniff", ...extra
  };
  if (origin && (mode === "owner" ? EDUCATION : PLAY).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = mode === "ingest" ? "POST, OPTIONS" : "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = mode === "owner"
      ? "authorization, apikey, x-client-info, content-type" : "content-type, apikey, x-client-info";
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}
function secret(env: Dependencies["env"], modern: string, legacy: string): string {
  const old = env(legacy);
  if (old) return old;
  try { const keys = JSON.parse(env(modern) || "{}"); return typeof keys.default === "string" ? keys.default : ""; }
  catch { return ""; }
}
function config(env: Dependencies["env"], mode: Mode) {
  const url = (env("SUPABASE_URL") || "").replace(/\/$/, "");
  const key = mode === "ingest" ? secret(env, "SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY")
    : secret(env, "SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key ? { url, key } : null;
}
function apiHeaders(key: string, token?: string) {
  const result: Record<string,string> = { "Content-Type": "application/json", apikey: key };
  if (token) result.Authorization = "Bearer " + token;
  else if (key.startsWith("eyJ")) result.Authorization = "Bearer " + key;
  return result;
}
async function boundedBody(req: Request): Promise<Record<string,unknown>> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get("content-type") || "")) throw new Error("content_type");
  const announced = req.headers.get("content-length");
  if (announced && (!/^\d+$/.test(announced) || Number(announced) > MAX_BODY)) throw new Error("too_large");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new Error("too_large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("invalid_request");
    return parsed;
  } finally { reader.releaseLock(); }
}
function source(value: unknown): value is Source { return value === "education" || value === "play"; }
function errorCode(err: unknown): string { return err instanceof Error ? err.message : ""; }

export function createHandler(mode: Mode, deps: Dependencies) {
  return async function handler(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    const send = (status: number, body: unknown, extra?: Record<string,string>) => response(status, body, origin, mode, extra);
    if (!origin || !(mode === "owner" ? EDUCATION : PLAY).has(origin)) return send(403, { ok: false, error: "origin_not_allowed" });
    if (req.method === "OPTIONS") return send(204, null);
    if (req.method !== (mode === "ingest" ? "POST" : "GET")) return send(405, { ok: false, error: "method_not_allowed" });
    let params: Record<string,unknown>, rpc: string, token: string | undefined;
    if (mode === "ingest") {
      let body;
      try { body = await boundedBody(req); }
      catch (e) { const code = errorCode(e); return send(code === "too_large" ? 413 : code === "content_type" ? 415 : 400, { ok: false, error: code === "too_large" ? "request_too_large" : "invalid_request" }); }
      if (Object.keys(body).sort().join(",") !== "event_nonce,event_type,resource_id,source"
          || !source(body.source) || typeof body.resource_id !== "string" || !ID.test(body.resource_id)
          || typeof body.event_type !== "string" || !EVENTS.has(body.event_type)
          || typeof body.event_nonce !== "string" || !NONCE.test(body.event_nonce)
          || (body.source === "education" ? !EDUCATION.has(origin) || body.event_type === "game_launch" : body.event_type !== "game_launch")) {
        return send(400, { ok: false, error: "invalid_event" });
      }
      params = { p_source: body.source, p_resource_id: body.resource_id, p_event_type: body.event_type, p_event_nonce: body.event_nonce };
      rpc = "mbm_usage_record_event";
    } else {
      const url = new URL(req.url), keys = [...url.searchParams.keys()];
      const src = url.searchParams.get("source");
      if (!source(src) || url.href.length > 8192 || keys.some(k => k !== "source" && (mode === "owner" || k !== "ids"))
          || new Set(keys).size !== keys.length) return send(400, { ok: false, error: "invalid_query" });
      const ids = url.searchParams.get("ids")?.split(",") || [];
      if (ids.length > 50 || ids.some(id => !ID.test(id))) return send(400, { ok: false, error: "invalid_query" });
      params = { p_source: src };
      if (mode === "public") params.p_ids = [...new Set(ids)];
      else {
        const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.headers.get("authorization") || "");
        if (!match) return send(401, { ok: false, error: "sign_in_required" });
        token = match[1];
      }
      rpc = mode === "owner" ? "mbm_usage_owner_summary" : "mbm_usage_public_summary";
    }
    const cfg = config(deps.env, mode);
    if (!cfg) return send(503, { ok: false, error: "service_not_configured" });
    try {
      if (mode === "owner") {
        // Verify with Auth, never trust decoded browser claims or user_metadata.
        const auth = await deps.fetch(cfg.url + "/auth/v1/user", { headers: apiHeaders(cfg.key, token), signal: AbortSignal.timeout(5000) });
        if (!auth.ok) return auth.status >= 500 || auth.status === 429
          ? send(503, { ok: false, error: "service_unavailable" })
          : send(401, { ok: false, error: "sign_in_required" });
        const user = await auth.json();
        if (!user || typeof user.id !== "string" || user.is_anonymous === true) return send(401, { ok: false, error: "sign_in_required" });
      }
      const result = await deps.fetch(cfg.url + "/rest/v1/rpc/" + rpc, {
        method: "POST", headers: apiHeaders(cfg.key, token), body: JSON.stringify(params), signal: AbortSignal.timeout(5000)
      });
      if (!result.ok) {
        let code = "", message = "";
        try { const err = await result.json(); code = err.code || ""; message = err.message || ""; } catch { /* Fail closed. */ }
        if (code === "54000") return send(429, { ok: false, error: "rate_limited" }, { "Retry-After": "60" });
        if (code === "23505") return send(409, { ok: false, error: "event_nonce_conflict" });
        if (code === "22023") return send(400, { ok: false, error: "invalid_event" });
        if (message === "usage_disabled") return send(503, { ok: false, error: "collection_disabled" });
        if (mode === "owner" && (code === "42501" || result.status === 403)) return send(403, { ok: false, error: "owner_required" });
        if (mode === "owner" && result.status === 401) return send(401, { ok: false, error: "sign_in_required" });
        return send(503, { ok: false, error: "service_unavailable" });
      }
      const data = await result.json();
      if (mode === "ingest") {
        if (!data || typeof data.counted !== "boolean") return send(503, { ok: false, error: "service_unavailable" });
        return send(202, { ok: true, counted: data.counted });
      }
      if (!data || data.schema !== 1 || !source(data.source)) return send(503, { ok: false, error: "service_unavailable" });
      return send(200, data);
    } catch { return send(503, { ok: false, error: "service_unavailable" }); }
  };
}
