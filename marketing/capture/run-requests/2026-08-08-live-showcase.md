# Made by Matt live showcase capture request

Sentinel: `mbm-live-showcase-video-2026-08-08`

Run the reusable production capture workflow against the live Made by Matt estate and publish the resulting media package as a workflow artifact.

QA history: the prior run passed every automated production/capture/build gate, but independent visual inspection rejected the Games edit because Apex Kick remained on its title screen. The source now presses the game's genuine `#bPlay` / “Play Division” control before performing the gameplay gesture on desktop and mobile. This rerun must therefore contain a real in-match gameplay surface rather than title-only footage.

This request file is disposable and must not be merged into `main`.
