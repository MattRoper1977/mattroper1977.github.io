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
execFileSync(FFMPEG, ['-v', 'quiet', '-i', FILE, '-vf', `signalstats,metadata=print:file=${tmp}`, '-an', '-f', 'null', '-'], { stdio: 'ignore' });
const t = fs.readFileSync(tmp, 'utf8');
const ystd = [...t.matchAll(/lavfi\.signalstats\.YSTD=([0-9.]+)/g)].map(m => parseFloat(m[1]));
const yavg = [...t.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)].map(m => parseFloat(m[1]));
fs.rmSync(dir, { recursive: true, force: true });

const meanStd = ystd.reduce((s, x) => s + x, 0) / (ystd.length || 1);
ok('frames-are-not-flat', meanStd > 8, 'mean YSTD ' + meanStd.toFixed(1));
let motion = 0;
for (let i = 1; i < yavg.length; i++) motion += Math.abs(yavg[i] - yavg[i - 1]);
ok('frames-actually-change', motion / (yavg.length || 1) > 0.05, 'mean |dYAVG| ' + (motion / (yavg.length || 1)).toFixed(3));
ok('frame-sample-non-empty', ystd.length > 10, ystd.length + ' frames measured');

console.log('CLIP_BYTES=' + fs.statSync(FILE).size);
console.log('CLIP_KB=' + kb);
console.log('CLIP_VERIFY=' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
