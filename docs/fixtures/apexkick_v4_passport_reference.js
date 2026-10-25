/*
 * Frozen reference for docs/CONTRACT_sports_passport_v4.md (ruling AK10-P, AK10-S R-3).
 *
 * Source: apexkick/index.html as served before Apex Kick: World Stage V10 replaced it
 *   993,824 bytes, sha256 097caf2618315fffc3d0765271dc3c05b6b2795f8ef8592edb1d45d823b7c17e
 *   (Site main 6049e6f). Recover the whole file with: git show 6049e6f:apexkick/index.html
 *
 * Each line below is copied byte-for-byte from that file; the comment above it names
 * its original line number. This file is a citation target, never served or run.
 *
 * Drift recorded: the contract cited :3572-:3573 for the C1 boot merge. In this file
 * those two lines are squad normalisation, not the passport. The boot read is :3612
 * (loadPassport) and the merge write is :3618 (savePassport re-reads, merges, writes).
 */
// apexkick/index.html:886
  function normalizePassport(raw, preferredNode) {
// apexkick/index.html:904
      seasonId: PASSPORT_SEASON,
// apexkick/index.html:928
    output.lamport = Math.max.apply(Math, clocks);
// apexkick/index.html:1268
    if (GAME_IDS.indexOf(game) < 0) throw new Error('Award game id is invalid.');
// apexkick/index.html:3612
  var raw=null;try{raw=localStorage.getItem(PASSPORT_KEY);if(raw)return ensurePassport(JSON.parse(raw));}catch(e){try{if(raw!==null)localStorage.setItem(PASSPORT_CORRUPT_BACKUP,raw)}catch(_){} }
// apexkick/index.html:3618
function savePassport(){if(!Passport)return;try{var raw=localStorage.getItem(PASSPORT_KEY),latest=null;if(raw){try{latest=ensurePassport(JSON.parse(raw))}catch(e){try{localStorage.setItem(PASSPORT_CORRUPT_BACKUP,raw)}catch(_){}}}Passport=latest?mergePassportForWrite(latest,Passport):ensurePassport(Passport);localStorage.setItem(PASSPORT_KEY,JSON.stringify(Passport))}catch(e){}}
