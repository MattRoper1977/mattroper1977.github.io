// mbm-accounts-members-mailing-2026-08-08
// Authenticated self-service unsubscribe, for the /account/ page.
// BUTTONDOWN_API_KEY/buttondown_api_key stays in Supabase Edge Function secret storage.
//
// WHY THIS IS AUTHENTICATED WHILE SUBSCRIBE IS NOT:
// an unauthenticated endpoint that takes an address and unsubscribes it would
// let anyone remove anyone from the list, and would answer "was this address
// subscribed?" to a stranger. So the address here is NEVER read from the
// request body — it is derived from the caller's verified JWT, exactly as
// delete-account derives its user id. There is no address parameter to forge.
//
// Because the caller is authenticated and is asking about their own verified
// address, reporting their real state back to them is not an enumeration leak;
// it is their own data. That is why this function may distinguish
// 'unsubscribed' from 'not_subscribed' where subscribe-mailing-list may not.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED = new Set((Deno.env.get('MBM_ALLOWED_ORIGINS') || 'https://madebymatt.uk').split(',').map(x => x.trim()).filter(Boolean))
function cors(origin: string | null) {
  const safe = origin && ALLOWED.has(origin) ? origin : 'https://madebymatt.uk'
  return { 'Access-Control-Allow-Origin': safe, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
function json(status: number, body: unknown, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) }

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' }, origin)
  if (origin && !ALLOWED.has(origin)) return json(403, { ok: false, message: 'Origin not allowed.' }, origin)

  const url = Deno.env.get('SUPABASE_URL') || ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const token = Deno.env.get('BUTTONDOWN_API_KEY') || Deno.env.get('buttondown_api_key') || ''
  if (!url || !anon || !token) return json(503, { ok: false, message: 'The mailing list is not configured yet.' }, origin)

  const authHeader = req.headers.get('Authorization') || ''
  if (!/^Bearer\s+\S+/i.test(authHeader)) return json(401, { ok: false, message: 'Sign in again before changing your mailing preferences.' }, origin)

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt)
  if (userError || !userData.user) return json(401, { ok: false, message: 'Your session is no longer valid. Sign in again and retry.' }, origin)

  // The ONLY source of the address. Never req.json().
  const email = String(userData.user.email || '').trim().toLowerCase()
  if (!email) return json(400, { ok: false, message: 'This account has no email address on record.' }, origin)

  const bd = (path: string, init?: RequestInit) => fetch(`https://api.buttondown.com/v1/${path}`, {
    ...init, headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers || {}) }
  })

  let lookup: Response
  try {
    lookup = await bd(`subscribers?email=${encodeURIComponent(email)}`)
  } catch (_) {
    return json(502, { ok: false, message: 'The mailing service could not be reached. Please try again.' }, origin)
  }
  if (lookup.status === 429) return json(429, { ok: false, message: 'Too many requests. Please try again later.' }, origin)
  if (!lookup.ok) return json(502, { ok: false, message: 'The mailing service could not complete that request. Please try again.' }, origin)

  const found = ((await lookup.json().catch(() => ({}))).results || [])
    .find((s: { email_address?: string }) => String(s.email_address || '').toLowerCase() === email)
  if (!found) return json(200, { ok: true, state: 'not_subscribed' }, origin)
  if (found.subscriber_type === 'unsubscribed') return json(200, { ok: true, state: 'unsubscribed' }, origin)

  let patch: Response
  try {
    patch = await bd(`subscribers/${found.id}`, { method: 'PATCH', body: JSON.stringify({ subscriber_type: 'unsubscribed' }) })
  } catch (_) {
    return json(502, { ok: false, message: 'The mailing service could not be reached. Please try again.' }, origin)
  }
  // Fail closed: never report an unsubscribe the provider did not accept.
  if (!patch.ok) return json(502, { ok: false, message: 'The mailing service could not complete that request. Please try again.' }, origin)
  return json(200, { ok: true, state: 'unsubscribed' }, origin)
})
