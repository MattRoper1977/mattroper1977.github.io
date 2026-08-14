/* flicker_analyse.mjs — the estate's ONE luminance-flicker analyser.
 *
 * This was measure_hearth_flicker.mjs's private signal maths, extracted the
 * moment a second game needed a flash census. The alternative was a second
 * analyser, and two analysers is how two standards start: they agree for a
 * while, then one of them gets a fix the other never hears about, and the
 * numbers in two PRs stop being comparable without anyone noticing. Extracting
 * it means the hearth's figures and Global Games' figures are produced by the
 * same code, and a correction to the method lands on both at once.
 *
 * Nothing about the method changed in the move. The two decisions that make it
 * trustworthy were both learned the hard way and are preserved verbatim:
 *
 *   PROMINENCE, WITH A THRESHOLD PROPORTIONAL TO THE SIGNAL'S OWN RANGE.
 *   The first version used an absolute tolerance, which made the count depend
 *   on whether the units were 0-1 or 0-255 — it reported 0 peaks for the very
 *   waveform it was built to measure, and 26/sec for the same waveform scaled
 *   by 100.
 *
 *   A SELF-TEST THAT RECOVERS KNOWN RATES. A rate-measuring tool that has never
 *   been shown to recover a rate it already knows is an opinion generator. Any
 *   caller can run selfTest() and should before quoting a number.
 */

export function analyse(series, fps = 60) {
  const n = series.length;
  if (!n) return { peaksPerSec: 0, zeroXPerSec: 0, worstFrameSwing: 0, peakToPeak: 0, mean: 0, samples: 0 };
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const c = series.map(v => v - mean);
  const min = Math.min(...series), max = Math.max(...series);
  const ptp = max - min;

  const tol = ptp * 0.05;
  let peaks = 0;
  for (let i = 1; i < n - 1; i++) {
    if (c[i] > c[i - 1] && c[i] >= c[i + 1]) {
      let l = c[i]; for (let j = i - 1; j >= 0 && c[j] <= c[j + 1]; j--) l = Math.min(l, c[j]);
      let r = c[i]; for (let j = i + 1; j < n && c[j] <= c[j - 1]; j++) r = Math.min(r, c[j]);
      if (c[i] - Math.max(l, r) > tol) peaks++;
    }
  }
  let crossings = 0;
  for (let i = 1; i < n; i++) if ((c[i - 1] < 0 && c[i] >= 0) || (c[i - 1] > 0 && c[i] <= 0)) crossings++;

  let worst = 0;
  for (let i = 1; i < n; i++) worst = Math.max(worst, Math.abs(series[i] - series[i - 1]));

  const dur = n / fps;
  return {
    peaksPerSec: +(peaks / dur).toFixed(3),
    zeroXPerSec: +((crossings / 2) / dur).toFixed(3),
    worstFrameSwing: +worst.toFixed(3),
    peakToPeak: +ptp.toFixed(3),
    mean: +mean.toFixed(2),
    samples: n
  };
}

/* ===========================================================================
 * THE LENS  (F3 / R12)
 *
 * Everything above is the signal maths, and the signal maths was never wrong.
 * What was wrong sat one step UPSTREAM, in every caller: each reduced a frame
 * to a single scalar by taking the mean luminance of the WHOLE canvas, and a
 * mean over the whole frame dilutes a localised strobe in proportion to how
 * little of the frame it covers. Both instruments said so themselves -
 * measure_olympics_flash.mjs:91 put it at about a third for a third-screen
 * strobe, measure_driving_flash.mjs:85 at about a twentieth - and the Depths
 * census then proved it in the wild: a real flash measured
 *
 *     9.97-14.91 Hz over the changing region,  0.000 Hz over the whole viewport.
 *
 * A clean result from that instrument is not a clean result. So the lens is
 * fixed here, at the one locus all five callers share.
 *
 * ADDITIVE BY CONSTRUCTION. analyse() and selfTest() are untouched, byte for
 * byte, because R11 requires the Emberwild before/after to keep 2.1's lens and
 * because silently moving every previously-quoted number would destroy the
 * comparability this file was extracted to protect. Callers opt in.
 * ========================================================================= */

/* Rec. 709 relative luminance, 0-1, from packed RGBA. */
function lum(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

/*
 * Reduce one RGBA frame to a grid of per-tile mean luminances.
 *
 * The grid is the whole point: a strobe confined to one tile keeps its full
 * amplitude in that tile's series instead of being averaged against the static
 * remainder. grid=8 gives 64 tiles, so a flash covering a sixty-fourth of the
 * frame is still measured near its true amplitude rather than at a sixty-fourth
 * of it.
 */
export function reduceFrameToTiles(rgba, width, height, grid = 8) {
  const out = new Float64Array(grid * grid);
  const counts = new Uint32Array(grid * grid);
  for (let y = 0; y < height; y++) {
    const ty = Math.min(grid - 1, (y * grid / height) | 0);
    for (let x = 0; x < width; x++) {
      const tx = Math.min(grid - 1, (x * grid / width) | 0);
      const i = (y * width + x) * 4;
      const t = ty * grid + tx;
      out[t] += lum(rgba[i], rgba[i + 1], rgba[i + 2]);
      counts[t]++;
    }
  }
  for (let t = 0; t < out.length; t++) if (counts[t]) out[t] /= counts[t];
  return out;
}

/*
 * Run analyse() over every tile and over the whole-frame mean, and report both.
 *
 * BOTH, deliberately. R11 requires like-for-like against baselines taken on the
 * old lens, and a bare swap would make every historical figure incomparable
 * without saying so. `whole` is what the old instrument would have reported;
 * `worst` is what is actually happening on screen. Where they disagree, the
 * disagreement IS the finding.
 *
 * The worst tile is chosen on rate among tiles whose own peak-to-peak clears
 * `amplitudeFloor` - without that, a tile carrying nothing but rounding noise
 * can post a high rate on a signal no eye could see, which is the mirror of the
 * defect being fixed.
 */
export function analyseTiled(frameTiles, fps = 60, { amplitudeFloor = 0.01 } = {}) {
  const frames = frameTiles.length;
  if (!frames) return { whole: analyse([], fps), worst: analyse([], fps), worstTile: -1, tiles: 0, frames: 0, tilesAboveFloor: 0, dilution: 1 };
  const nTiles = frameTiles[0].length;

  const wholeSeries = frameTiles.map(t => {
    let s = 0; for (let i = 0; i < t.length; i++) s += t[i];
    return s / t.length;
  });

  let worst = null, worstTile = -1, considered = 0;
  for (let t = 0; t < nTiles; t++) {
    const series = new Array(frames);
    for (let f = 0; f < frames; f++) series[f] = frameTiles[f][t];
    const r = analyse(series, fps);
    if (r.peakToPeak < amplitudeFloor) continue;
    considered++;
    if (!worst || r.peaksPerSec > worst.peaksPerSec
      || (r.peaksPerSec === worst.peaksPerSec && r.peakToPeak > worst.peakToPeak)) {
      worst = r; worstTile = t;
    }
  }

  const whole = analyse(wholeSeries, fps);
  return {
    whole,
    worst: worst || whole,
    worstTile,
    tilesAboveFloor: considered,
    tiles: nTiles,
    frames,
    dilution: worst ? +(worst.peakToPeak / (whole.peakToPeak || 1e-9)).toFixed(1) : 1
  };
}

/*
 * The lens has its own self-test, and it is a POSITIVE CONTROL as much as a
 * check: it builds a frame sequence in which a known rate strobes over a small
 * region and demands that the tiled lens recovers that rate WHILE the
 * whole-frame mean misses it. If that second half ever stops holding, the
 * synthetic case has stopped reproducing the defect and the test has quietly
 * become decorative.
 */
export function selfTestLens(fps = 60) {
  const W = 64, H = 64, SECONDS = 8, grid = 8;
  const lines = [];
  let bad = 0;

  /*
   * `drift` is not decoration, and getting this wrong once is why it is
   * documented here. On a PERFECTLY STATIC background the whole-frame mean
   * still recovers the rate: analyse() sets its prominence threshold
   * proportional to the signal's own range (tol = ptp * 0.05), so when
   * dilution shrinks the strobe it shrinks the threshold with it. Only the
   * AMPLITUDE collapses - measured here at 62.5x for a 64th-of-frame patch.
   *
   * The Depths read 0.000 Hz because a real frame is not static. Camera pan,
   * parallax and the time-of-day grade give the whole-frame series a large
   * range of its own, and the diluted strobe then falls UNDER that proportional
   * threshold and is rejected as noise. `drift` is that competing large-area
   * motion, and it is what makes this case reproduce the defect rather than
   * merely resemble it.
   */
  const build = (hz, coverage, drift) => {
    const frames = [];
    const side = Math.max(1, Math.round(Math.sqrt(coverage * W * H)));
    for (let f = 0; f < fps * SECONDS; f++) {
      const t = f / fps;
      const on = Math.sin(2 * Math.PI * hz * t) > 0;
      const bg = 128 + (drift ? Math.sin(2 * Math.PI * 0.35 * t) * 60 : 0);
      const rgba = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const inPatch = x < side && y < side;
          const v = inPatch ? (on ? 255 : 0) : bg;
          rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
        }
      }
      frames.push(reduceFrameToTiles(rgba, W, H, grid));
    }
    return frames;
  };

  // --- A. static background: the rate survives, the AMPLITUDE is destroyed ---
  for (const [hz, coverage, label] of [
    [3.0, 1 / 64, 'a 3 Hz strobe over a 64th of a STATIC frame'],
    [14.91, 1 / 64, "the Depths' 14.91 Hz over a 64th of a STATIC frame"],
  ]) {
    const r = analyseTiled(build(hz, coverage, false), fps);
    const okWorst = Math.abs(r.worst.peaksPerSec - hz) <= 0.4;
    const okDilute = r.dilution >= 10;
    if (!okWorst) bad++;
    if (!okDilute) bad++;
    lines.push(`${okWorst ? 'PASS' : 'FAIL'}  ${label} -> tiled lens ${r.worst.peaksPerSec} Hz (expected ~${hz})`);
    lines.push(`${okDilute ? 'PASS' : 'FAIL'}  CONTROL: the old lens dilutes its amplitude ${r.dilution}x ` +
      `(whole p-p ${r.whole.peakToPeak} vs tiled ${r.worst.peakToPeak})`);
  }

  // --- B. competing large-area motion: THE DEPTHS CONDITION, rate lost -------
  for (const [hz, coverage, label] of [
    [10.0, 1 / 64, 'a 10 Hz strobe under competing large-area drift'],
    [14.91, 1 / 64, "the Depths' 14.91 Hz under competing large-area drift"],
  ]) {
    const r = analyseTiled(build(hz, coverage, true), fps);
    const okWorst = Math.abs(r.worst.peaksPerSec - hz) <= 0.4;
    // This is the assertion that reproduces 14.91 Hz -> 0.000 Hz.
    const okBlind = r.whole.peaksPerSec < hz * 0.5;
    if (!okWorst) bad++;
    if (!okBlind) bad++;
    lines.push(`${okWorst ? 'PASS' : 'FAIL'}  ${label} -> tiled lens ${r.worst.peaksPerSec} Hz (expected ~${hz})`);
    lines.push(`${okBlind ? 'PASS' : 'FAIL'}  CONTROL: whole-frame mean reads ${r.whole.peaksPerSec} Hz — ` +
      `the real flash is invisible to the old lens`);
  }

  // And it must NOT invent a rate on a genuinely static frame.
  const staticFrames = [];
  for (let f = 0; f < fps * SECONDS; f++) {
    const rgba = new Uint8ClampedArray(W * H * 4).fill(128);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    staticFrames.push(reduceFrameToTiles(rgba, W, H, grid));
  }
  const st = analyseTiled(staticFrames, fps);
  const okStatic = st.worst.peaksPerSec === 0;
  if (!okStatic) bad++;
  lines.push(`${okStatic ? 'PASS' : 'FAIL'}  static frame invents no rate -> ${st.worst.peaksPerSec} Hz, ` +
    `${st.tilesAboveFloor} tile(s) above the amplitude floor`);

  return { bad, lines };
}

/* Returns {bad, lines} rather than printing, so each caller reports in its own
   voice while the CASES stay identical across the estate. */
export function selfTest(fps = 60) {
  const mk = f => { const a = []; for (let i = 0; i < fps * 8; i++) a.push(f(i / fps)); return a; };
  const flick = t => 0.8 + Math.sin(t * 8) * 0.12 + Math.sin(t * 17) * 0.08;
  const cases = [
    ['pure 17 rad/s  (2.706 Hz)', mk(t => Math.sin(t * 17)), 2.706],
    ['pure 8 rad/s   (1.273 Hz)', mk(t => Math.sin(t * 8)), 1.273],
    ['the shipped flick waveform', mk(flick), 2.706],
    ['the same, scaled x100     ', mk(t => flick(t) * 100), 2.706],
    ['static                    ', mk(() => 0.8), 0]
  ];
  let bad = 0; const lines = [];
  for (const [name, sig, expect] of cases) {
    const r = analyse(sig, fps);
    const ok = Math.abs(r.peaksPerSec - expect) <= 0.15;
    if (!ok) bad++;
    lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name} -> ${r.peaksPerSec} peaks/sec (expected ~${expect})`);
  }
  return { bad, lines };
}
