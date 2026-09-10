// Canvas non-blankness, measured correctly for BOTH games.
//
// Why this is not a one-liner: Rally takes its context with
// preserveDrawingBuffer:false, so drawImage(canvas) from outside a frame reads
// an already-cleared buffer and reports zero painted pixels on a game that is
// rendering perfectly. That artifact produced seven false "hostile save killed
// the game" findings before it was caught.
//
// So sample INSIDE requestAnimationFrame, where the drawing buffer is still
// live, and take the best of several frames rather than a single sample.
export const sampleCanvas = page => page.evaluate(() => new Promise(resolve => {
  const c = document.querySelector('canvas#gl, canvas');
  if (!c || !c.width) return resolve({ err: 'no canvas' });
  const off = document.createElement('canvas');
  off.width = 64; off.height = 48;
  const g = off.getContext('2d', { willReadFrequently: true });
  let best = { distinct: 0, lit: 0, total: off.width * off.height, frames: 0 };
  let n = 0;
  const step = () => {
    try {
      g.clearRect(0, 0, off.width, off.height);
      g.drawImage(c, 0, 0, off.width, off.height);
      const d = g.getImageData(0, 0, off.width, off.height).data;
      const seen = new Set();
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
        if (d[i] + d[i + 1] + d[i + 2] > 24) lit++;
      }
      if (lit > best.lit) best = { distinct: seen.size, lit, total: off.width * off.height, frames: n };
    } catch (e) { /* keep sampling */ }
    if (++n < 20) requestAnimationFrame(step);
    else resolve(best);
  };
  requestAnimationFrame(step);
}));
