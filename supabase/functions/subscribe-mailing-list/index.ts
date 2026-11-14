// mbm-accounts-members-mailing-2026-08-08
// Public mailing-list subscription proxy.
// BUTTONDOWN_API_KEY/buttondown_api_key stays in Supabase Edge Function secret storage.
// No subscriber address, provider response body or credential is logged.
const ALLOWED = new Set((Deno.env.get('MBM_ALLOWED_ORIGINS') || 'https://madebymatt.uk,https://www.madebymatt.uk,https://mattroper1977.github.io').split(',').map(x => x.trim()).filter(Boolean))
function cors(origin: string | null) {
  const safe = origin && ALLOWED.has(origin) ? origin : 'https://madebymatt.uk'
  return { 'Access-Control-Allow-Origin': safe, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
function json(status: number, body: unknown, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) }
function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

// Per-isolate sliding-window guard and per-address cooldown so anonymous floods
// cannot exhaust the upstream Buttondown firewall bypass budget.
const MINUTE_WINDOW_MS = 60_000
const HOUR_WINDOW_MS = 3_600_000
const EMAIL_COOLDOWN_MS = 300_000
const MAX_PER_MINUTE = 6
const MAX_PER_HOUR = 30
const recentCalls: number[] = []
const recentEmails = new Map<string, number>()

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function allowInMemoryBurst(emailKey: string, now: number): { allowed: boolean, duplicateCooldown: boolean } {
  while (recentCalls.length > 0 && now - recentCalls[0] > HOUR_WINDOW_MS) recentCalls.shift()
  for (const [k, ts] of recentEmails.entries()) {
    if (now - ts > EMAIL_COOLDOWN_MS) recentEmails.delete(k)
  }
  const prevEmailTs = recentEmails.get(emailKey)
  if (prevEmailTs !== undefined && now - prevEmailTs < EMAIL_COOLDOWN_MS) {
    return { allowed: false, duplicateCooldown: true }
  }
  const inLastMinute = recentCalls.filter(ts => now - ts < MINUTE_WINDOW_MS).length
  if (inLastMinute >= MAX_PER_MINUTE || recentCalls.length >= MAX_PER_HOUR) {
    return { allowed: false, duplicateCooldown: false }
  }
  recentCalls.push(now)
  recentEmails.set(emailKey, now)
  return { allowed: true, duplicateCooldown: false }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' }, origin)
  if (!origin || !ALLOWED.has(origin)) return json(403, { ok: false, message: 'Origin not allowed.' }, origin)

  const token = Deno.env.get('BUTTONDOWN_API_KEY') || Deno.env.get('buttondown_api_key') || ''
  if (!token) return json(503, { ok: false, message: 'The mailing list is not configured yet.' }, origin)

  let body: { email?: string, consent?: boolean, company?: string } = {}
  try { body = await req.json() } catch (_) { return json(400, { ok: false, message: 'Please check the form and try again.' }, origin) }
  const email = String(body.email || '').trim().toLowerCase()
  if (String(body.company || '').trim()) return json(200, { ok: true, state: 'pending_confirmation' }, origin)
  if (body.consent !== true) return json(400, { ok: false, message: 'Consent is required to join the mailing list.' }, origin)
  if (!validEmail(email)) return json(400, { ok: false, message: 'Enter a valid email address.' }, origin)

  const emailDigest = await sha256Hex('mbm-subscribe-v1|' + email)
  const memGate = allowInMemoryBurst(emailDigest, Date.now())
  if (memGate.duplicateCooldown) return json(200, { ok: true, state: 'pending_confirmation' }, origin)
  if (!memGate.allowed) return json(429, { ok: false, message: 'The mailing list is busy right now. Please try again later.' }, origin)

  const sbUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '')
  const sbServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (sbUrl && sbServiceKey) {
    try {
      const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/check_mailing_subscribe_budget`, {
        method: 'POST',
        headers: {
          'apikey': sbServiceKey,
          'Authorization': `Bearer ${sbServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_email_hash: emailDigest })
      })
      if (rpcRes.status === 200) {
        const verdict = await rpcRes.json()
        if (verdict === 'cooldown') return json(200, { ok: true, state: 'pending_confirmation' }, origin)
        if (verdict === 'rate_limited') return json(429, { ok: false, message: 'The mailing list is busy right now. Please try again later.' }, origin)
      }
    } catch (_) {
      // Fall back to the in-isolate window if the database RPC is not yet installed.
    }
  }

  const headers = {
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Supabase is a server-to-server proxy and does not forward/store a
    // subscriber IP. Buttondown documents this header for integrations that
    // do not have the subscriber IP; it is rate-limited by Buttondown.
    'X-Buttondown-Bypass-Firewall': 'true'
  }

  let response: Response
  try {
    response = await fetch('https://api.buttondown.com/v1/subscribers', {
      method: 'POST', headers, body: JSON.stringify({ email_address: email })
    })
  } catch (_) {
    return json(502, { ok: false, message: 'The mailing service could not be reached. Please try again.' }, origin)
  }

  if (response.ok) return json(200, { ok: true, state: 'pending_confirmation' }, origin)
  if (response.status === 429) return json(429, { ok: false, message: 'The mailing list is busy right now. Please try again later.' }, origin)

  // Buttondown intentionally returns 400 for an existing subscriber. Never
  // infer "duplicate" from error prose: that previously let unrelated 400s
  // (including firewall blocks) masquerade as success. Prove existence through
  // the authenticated retrieve-by-email endpoint before returning the same
  // enumeration-safe public response as a first-time signup.
  if (response.status === 400 || response.status === 409) {
    try {
      const existing = await fetch(`https://api.buttondown.com/v1/subscribers/${encodeURIComponent(email)}`, {
        headers: { 'Authorization': `Token ${token}`, 'Accept': 'application/json' }
      })
      if (existing.ok) return json(200, { ok: true, state: 'pending_confirmation' }, origin)
      if (existing.status === 429) return json(429, { ok: false, message: 'The mailing list is busy right now. Please try again later.' }, origin)
    } catch (_) {
      return json(502, { ok: false, message: 'The mailing service could not be reached. Please try again.' }, origin)
    }
  }

  return json(502, { ok: false, message: 'The mailing service could not complete that request. Please try again.' }, origin)
})
