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
