/* /apexcurl/ — the gate its exclusion in data/hud-coverage.json cites.
 * The assertions live in tools/apex_rc_gate.mjs, shared with /apexvelodrome/:
 * two copies of them is the second-literal trap, one region change later. */
import { gate } from './apex_rc_gate.mjs';
await gate({
  name: 'Apex Curl',
  route: '/apexcurl/',
  global: 'apexCurl',
  /* The three keys the V6 build actually writes, measured by call site rather
   * than declared from memory: its own save, its V6 data blob, and the shared
   * sports passport. apex_curl_rc_stars_v1 is NOT here — the build reads it to
   * migrate a child's stars forward and never writes it, and the gate reports
   * reads separately for exactly that reason.
   *
   * mbm_sports_passport_v4 is listed because this assertion is about what the
   * build WRITES, not about what it owns. The passport is shared with four
   * other games; ownership of it is docs/CONTRACT_sports_passport_v4.md's
   * subject, and this list is not the place to assert it. */
  storageKeys: ['mbm_apex_curl_v4', 'mbm_apex_curl_v6_data', 'mbm_sports_passport_v4'],
});
