/* /apexvelodrome/ — the gate its exclusion in data/hud-coverage.json cites.
 * Two storage keys, not one: STARSTORE holds the challenge stars and STORAGE
 * holds personal bests and the replay. Both are declared so a later rename
 * cannot quietly drop one. */
import { gate } from './apex_rc_gate.mjs';
await gate({
  name: 'Apex Velodrome',
  route: '/apexvelodrome/',
  global: 'apexVelodrome',
  storageKeys: ['apex_velodrome_rc_stars_v1', 'apex_velodrome_rc_v1'],
});
