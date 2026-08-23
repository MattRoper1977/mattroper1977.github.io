/* /apexcurl/ — the gate its exclusion in data/hud-coverage.json cites.
 * The assertions live in tools/apex_rc_gate.mjs, shared with /apexvelodrome/:
 * two copies of them is the second-literal trap, one region change later. */
import { gate } from './apex_rc_gate.mjs';
await gate({
  name: 'Apex Curl',
  route: '/apexcurl/',
  global: 'apexCurl',
  storageKeys: ['apex_curl_rc_stars_v1'],
});
