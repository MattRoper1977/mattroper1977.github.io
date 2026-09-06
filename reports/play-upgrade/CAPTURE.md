# Fresh capture procedure and acceptance

Recordings are real Chrome browser output from new isolated contexts in the Play-only review workflow. Source games and gameplay state are never patched, seeded with wins or driven through debug actions. Read-only live snapshots may confirm focus, an animation finishing or enemies appearing; inputs remain ordinary keyboard, pointer and visible controls. The capture profile starts empty and records only non-personal game progress.

Raw WebM files retain setup and actions. Public assets are trimmed silent H.264/yuv420p MP4 with fast-start metadata plus fresh WebP posters. Silent delivery carries no meaningful speech requiring captions; each clip has a written gameplay description. Accepted deployment filenames form an explicit allowlist. Posters load first and video sources are installed only on Watch. Raw recordings and rejected attempts are never copied to the website.

`capture-request.json` is the list to recapture in the next review run. Keep accepted clips and their original capture provenance when their source payload is unchanged; do not relabel a previous recording as newly captured. Empty the request list once visual acceptance is complete. A successful capture step only creates candidates. Set `status: accepted` after inspecting real action and update hashes after compression/trimming. The release renderer checks the final payload and every media hash.

## Player recipes

- Emberwild: New journey, ordinary identity/Vigil controls and starter attunement. Restore at the hearth. Focus the actual game canvas; read-only wait for each walking animation to finish. N×3, E×4, N×3, W×2 reaches Ena’s clinic. Canvas focus matters because the accessible semantic choices intentionally consume movement keys. Software rendering can stretch simulation time.
- Apex Kick: Practice, then arrows/Q/Space for real free kicks. The accepted take contains real goalkeeper/wall outcomes; no goal was forced.
- Voxel Frontier: Fresh Creative world; acquire pointer lock normally. Look down about 45 degrees at reachable solid terrain, select Planks (7), place with right-click, strafe and inspect. A distant sea/sky crosshair cannot place a block. The accepted take’s idle tail was trimmed to 13 seconds.
- Off-Brand: Crew, Begin the Watch, Got it, Skip tutorial. Walk to Ink Store through the visible map. Use Do the work and click the five visible Trace the M anchors in order. Confirm Work banked; AI commission changes alone do not prove player completion.
- Lumins: First Steps. Bridge is 4; toolbar elements are `.skill`, not buttons. Place at logical grid (15,13) and (17,12) using the 40×24 canvas grid. This ordinary solution rescues 5 of 5 using 2 interventions. The first failed attempt selected unavailable Carve Down and is rejected.
- Nova Siege: Start, await the asynchronous intro, skip with Enter, await real enemies. Keyboard-only play provides the game’s standard nearest-enemy aiming: hold Space, strafe and dash with Shift. Moving the pointer switches to manual aim. Slow software rendering requires waiting for actual readiness, not a short fixed delay.

## Rejected attempts

Earlier recordings that remain in review artifacts are explicitly unaccepted: menus/onboarding, missed bridge controls, empty Voxel scenery, mostly stationary Emberwild, and Nova’s short readiness timeout. They are diagnostic evidence, not deployment placeholders. Only the manifest in `domain-split/play/media/` is authoritative for published assets.
