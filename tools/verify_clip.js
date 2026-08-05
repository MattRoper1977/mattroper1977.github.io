#!/usr/bin/env node
'use strict';
/**
 * Verify a FINISHED clip by extraction, never by trusting the encoder.
 * Rendered video never displays back into a session, so every claim about a
 * finished file is made from measurements taken off the file itself.
 *
 * Usage:
 *   node tools/verify_clip.js <file> --expect-w 480 --expect-h 930 \
 *        --min-seconds 17 --max-seconds 20 --min-kb 260 --max-kb 370 --require-silent
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const has = n => process.argv.includes('--' + n);
const FILE = process.argv[2];
const FFMPEG = arg('ffmpeg', process.env.FFMPEG || 'ffmpeg');
const FFPROBE = arg('ffprobe', process.env.FFPROBE || 'ffprobe');
if (!FILE || !fs.existsSync(FILE)) { console.error('usage: verify_clip.js <file>'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d ? '  [' + d + ']' : '')); };

const probe = JSON.parse(execFileSync(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', FILE], { encoding: 'utf8' }));
const v = probe.streams.find(s => s.codec_type === 'video');
const a = probe.streams.filter(s => s.codec_type === 'audio');
const kb = Math.round(fs.statSync(FILE).size / 1024);
const dur = parseFloat(probe.format.duration);

ok('dimensions', v.width === +arg('expect-w', v.width) && v.height === +arg('expect-h', v.height), v.width + 'x' + v.height);
ok('duration-in-range', dur >= +arg('min-seconds', 0) && dur <= +arg('max-seconds', 1e9), dur.toFixed(1) + 's');
ok('size-in-range', kb >= +arg('min-kb', 0) && kb <= +arg('max-kb', 1e9), kb + ' KB');
if (has('require-silent')) ok('silent-no-audio-stream', a.length === 0, a.length + ' audio stream(s)');

// Frame extraction + stddev: a clip of flat or frozen frames would satisfy
// every check above while showing nothing. Require real spatial variation and
// real change between frames.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
const tmp = path.join(dir, 'stats.txt');
// --measure-crop W:H:X:Y restricts the statistics to the PICTURE region.
// A pillarboxed 1080p cut is mostly solid bars by design, so measuring the
// whole frame reports the padding's flatness rather than the content's. The
// crop is disclosed on the command line and printed, so it can never be used
// to quietly hide a genuinely flat clip.
const CROP = arg('measure-crop', null);
const vf = (CROP ? `crop=${CROP},` : '') + `signalstats,metadata=print:file=${tmp}`;
if (CROP) console.log('  note  statistics measured on the picture region crop=' + CROP);
execFileSync(FFMPEG, ['-v', 'quiet', '-i', FILE, '-vf', vf, '-an', '-f', 'null', '-'], { stdio: 'ignore' });
const t = fs.readFileSync(tmp, 'utf8');
// Keys DERIVED from what signalstats actually emits, not assumed. An earlier
// version of this file measured YSTD — which signalstats does not produce —
// so the check read zero frames and could ONLY ever fail. A check that can
// only fail measures nothing, exactly as a check that can only pass measures
// nothing. Real keys: YMIN/YLOW/YAVG/YHIGH/YMAX/YDIF.
const num = k => [...t.matchAll(new RegExp('lavfi\\.signalstats\\.' + k + '=([0-9.]+)', 'g'))].map(m => parseFloat(m[1]));
const ylow = num('YLOW'), yhigh = num('YHIGH'), yavg = num('YAVG'), ydif = num('YDIF');
fs.rmSync(dir, { recursive: true, force: true });

const n = yavg.length;
ok('frame-sample-non-empty', n > 10, n + ' frames measured');
// Spatial spread: a flat or single-colour frame has YHIGH ~= YLOW.
const spread = ylow.length ? ylow.map((lo, i) => (yhigh[i] || 0) - lo) : [];
const meanSpread = spread.reduce((s, x) => s + x, 0) / (spread.length || 1);
ok('frames-are-not-flat', meanSpread > 20, 'mean (YHIGH-YLOW) ' + meanSpread.toFixed(1));
// Temporal change: YDIF is the per-frame difference from the previous frame.
const meanDif = ydif.reduce((s, x) => s + x, 0) / (ydif.length || 1);
ok('frames-actually-change', meanDif > 0.2, 'mean YDIF ' + meanDif.toFixed(3));

console.log('CLIP_BYTES=' + fs.statSync(FILE).size);
console.log('CLIP_KB=' + kb);
console.log('CLIP_VERIFY=' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
