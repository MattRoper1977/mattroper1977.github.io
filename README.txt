UAS REGISTER — DEPLOY PACK (2026-27)
====================================

WHAT'S INSIDE
  uas/index.html          the launch page  ->  madebymatt.uk/uas/
  uas/app.html            the app itself   ->  madebymatt.uk/uas/app.html
  hub-highlight-card.html paste-in card for your hub front page

WHERE IT GOES
  The repo that serves madebymatt.uk — the one whose
  Settings > Pages shows "Your site is live at madebymatt.uk"
  (it contains a CNAME file). That is your Lessons repo.

HOW TO UPLOAD (the safe way)
  1. On GitHub, open that repo > Add file > Upload files.
  2. Drag the whole "uas" FOLDER (not the files inside it) into
     the upload box, so GitHub keeps the folder.
     NEVER drop index.html loose into the repo root — it will
     replace your hub homepage (remember the Year Plan incident).
  3. Commit: "Add UAS Register — super teacher tool for 2026-27".
  4. Wait ~2 minutes, then visit madebymatt.uk/uas/

HIGHLIGHT IT ON THE HUB
  Edit your hub's index.html on GitHub (pencil icon), paste the
  contents of hub-highlight-card.html near the top of <body>,
  commit. The card links to /uas/ automatically.

AFTER IT'S LIVE
  - Test the Scan/OCR import tab on the live site (it only works
    when hosted, not in previews).
  - Run one real unit through and export a backup from Settings.

Matt's Apps · UAS Register v3.1 · 69/69 tests passing
