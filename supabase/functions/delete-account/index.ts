// mbm-accounts-members-mailing-2026-08-08
// Authenticated self-service account deletion.
// SUPABASE_SERVICE_ROLE_KEY is an Edge Function secret and must never be shipped
// to the browser or committed to Git.
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
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !anon || !service) return json(503, { ok: false, message: 'Account deletion is not configured.' }, origin)

  const authHeader = req.headers.get('Authorization') || ''
  if (!/^Bearer\s+\S+/i.test(authHeader)) return json(401, { ok: false, message: 'Sign in again before deleting the account.' }, origin)

  let body: { confirm?: boolean } = {}
  try { body = await req.json() } catch (_) {}
  if (body.confirm !== true) return json(400, { ok: false, message: 'Deletion confirmation is required.' }, origin)

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json(401, { ok: false, message: 'Your session is no longer valid. Sign in again and retry.' }, origin)

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await admin.auth.admin.deleteUser(userData.user.id)
  if (error) return json(500, { ok: false, message: 'Account deletion could not be completed.' }, origin)
  return json(200, { ok: true }, origin)
})
