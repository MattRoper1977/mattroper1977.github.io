#!/usr/bin/env node
'use strict';
/**
 * Photosensitivity gate — WCAG 2.3.1, no more than THREE general flashes in
 * any one-second window.
 *
 * THIS GATE HAS NO SWAP. A fail is a GAME finding: stop and report. Never
 * retune the seed, move the capture window, or adjust the encode to get
 * under the bar.
 *
 * Method. ffmpeg's signalstats reports YAVG per frame; that luma average is
 * used as the relative-luminance proxy (normalised 0..1). A general flash is
 * a PAIR of opposing luminance changes each >= 0.10, where the darker of the
 * pair is below 0.80 relative luminance — the WCAG general flash threshold.
 * Flashes are counted in a sliding one-second window at the file's real fps.
 *
 * Usage: node tools/flash_rate.js <file> [--limit 3] [--ffmpeg path] [--ffprobe path]
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const FILE = process.argv[2];
const LIMIT = parseInt(arg('limit', '3'), 10);
const FFMPEG = arg('ffmpeg', process.env.FFMPEG || 'ffmpeg');
const FFPROBE = arg('ffprobe', process.env.FFPROBE || 'ffprobe');
if (!FILE || !fs.existsSync(FILE)) { console.error('usage: flash_rate.js <file>'); process.exit(2); }

const probe = JSON.parse(execFileSync(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_streams', FILE], { encoding: 'utf8' }));
const v = probe.streams.find(s => s.codec_type === 'video');
const [num, den] = (v.avg_frame_rate || '25/1').split('/').map(Number);
const FPS = den ? num / den : 25;

const tmp = path.join(os.tmpdir(), 'flash-' + process.pid + '.txt');
execFileSync(FFMPEG, ['-v', 'quiet', '-i', FILE, '-vf', `signalstats,metadata=print:file=${tmp}`, '-an', '-f', 'null', '-'], { stdio: 'ignore' });
const text = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp);

const lum = [];
for (const m of text.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)) lum.push(parseFloat(m[1]) / 255);
if (lum.length < 2) { console.error('FLASH_ANALYSIS_FAILED: no luminance samples read — refusing to report a pass'); process.exit(2); }

// Opposing-change pairing: walk transitions, pair a rise with the next fall
// (or vice versa) when both cross the 0.10 threshold and the darker end is
// below 0.80.
const TH = 0.10, DARK = 0.80;
const events = [];
let lastExtreme = lum[0], dir = 0;
for (let i = 1; i < lum.length; i++) {
  const d = lum[i] - lastExtreme;
  if (Math.abs(d) >= TH) {
    const nd = Math.sign(d);
    if (dir !== 0 && nd !== dir && Math.min(lum[i], lastExtreme) < DARK) events.push(i);
    dir = nd; lastExtreme = lum[i];
  } else if (dir !== 0 && Math.sign(d) === dir) {
    lastExtreme = lum[i];
  }
}
// Sliding one-second window.
let worst = 0, worstAt = 0;
for (const e of events) {
  const n = events.filter(x => x > e - FPS && x <= e).length;
  if (n > worst) { worst = n; worstAt = e / FPS; }
}
console.log('FILE=' + FILE);
console.log('FPS=' + FPS.toFixed(2));
console.log('FRAMES_ANALYSED=' + lum.length);
console.log('LUMINANCE_RANGE=' + Math.min(...lum).toFixed(3) + '..' + Math.max(...lum).toFixed(3));
console.log('GENERAL_FLASHES_TOTAL=' + events.length);
console.log('WORST_FLASHES_PER_SECOND=' + worst + (worst ? ' (at ~' + worstAt.toFixed(1) + 's)' : ''));
console.log('WCAG_2_3_1_LIMIT=' + LIMIT);
if (worst > LIMIT) {
  console.log('PHOTOSENSITIVITY=FAIL');
  console.error('GAME FINDING — ' + worst + ' general flashes in one second exceeds the WCAG 2.3.1 limit of ' + LIMIT + '.');
  console.error('This gate has NO SWAP. Do not retune the capture; report the game.');
  process.exit(1);
}
console.log('PHOTOSENSITIVITY=PASS');
