// mbm-accounts-members-mailing-2026-08-08
// Public mailing-list subscription proxy.
// BUTTONDOWN_API_KEY/buttondown_api_key stays in Supabase Edge Function secret storage.
// No subscriber address, provider response body or credential is logged.
const ALLOWED = new Set((Deno.env.get('MBM_ALLOWED_ORIGINS') || 'https://madebymatt.uk').split(',').map(x => x.trim()).filter(Boolean))
function cors(origin: string | null) {
  const safe = origin && ALLOWED.has(origin) ? origin : 'https://madebymatt.uk'
  return { 'Access-Control-Allow-Origin': safe, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
function json(status: number, body: unknown, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) }
function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' }, origin)
  if (origin && !ALLOWED.has(origin)) return json(403, { ok: false, message: 'Origin not allowed.' }, origin)

  const token = Deno.env.get('BUTTONDOWN_API_KEY') || Deno.env.get('buttondown_api_key') || ''
  if (!token) return json(503, { ok: false, message: 'The mailing list is not configured yet.' }, origin)

  let body: { email?: string, consent?: boolean, company?: string } = {}
  try { body = await req.json() } catch (_) { return json(400, { ok: false, message: 'Please check the form and try again.' }, origin) }
  const email = String(body.email || '').trim().toLowerCase()
  if (String(body.company || '').trim()) return json(200, { ok: true, state: 'pending_confirmation' }, origin)
  if (body.consent !== true) return json(400, { ok: false, message: 'Consent is required to join the mailing list.' }, origin)
  if (!validEmail(email)) return json(400, { ok: false, message: 'Enter a valid email address.' }, origin)

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
