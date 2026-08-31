/* /apexvelodrome/ — the gate its exclusion in data/hud-coverage.json cites.
 * Declared writes are measured by call site. The two apex_velodrome_rc_* keys
 * are migration reads, while the export prefix is a filename; neither belongs
 * in this write contract. */
import { gate } from './apex_rc_gate.mjs';
await gate({
  name: 'Apex Velodrome',
  route: '/apexvelodrome/',
  global: 'apexVelodrome',
  storageKeys: [
    'mbm_apex_velodrome_v4',
    'mbm_apex_velodrome_v4_replay',
    'mbm_apex_velodrome_v4_stars',
    'mbm_apex_velodrome_v6_data',
    'mbm_sports_passport_v4',
  ],
});
