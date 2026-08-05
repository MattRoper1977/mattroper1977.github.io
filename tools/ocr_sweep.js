#!/usr/bin/env node
'use strict';
/**
 * OCR sweep — every capture window is read for anything that must never ship
 * in a public clip: dialogs, IP addresses, email addresses, notifications and
 * personal data.
 *
 * Run BEFORE chaining segments and AGAIN across each finished cut. Rendered
 * video never displays back into a session, so this is the only way the
 * content of a frame is ever actually inspected.
 *
 * Usage: node tools/ocr_sweep.js <file> [--fps 1] [--ffmpeg path]
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const FILE = process.argv[2];
const FPS = arg('fps', '1');
const FFMPEG = arg('ffmpeg', process.env.FFMPEG || 'ffmpeg');
if (!FILE || !fs.existsSync(FILE)) { console.error('usage: ocr_sweep.js <file>'); process.exit(2); }

const tess = spawnSync('tesseract', ['--version'], { encoding: 'utf8' });
if (tess.status !== 0) {
  console.error('OCR_UNAVAILABLE: tesseract is not installed.');
  console.error('Refusing to report a clean sweep that never ran — a gate that cannot run is not a pass.');
  process.exit(2);
}

// Posters are single-frame images; sampling them at fps=1 yields nothing, so
// the extraction path is chosen from what the file actually IS rather than
// assumed. Getting this wrong is how a poster's sweep silently produces no
// frames — and a sweep over zero frames is not a clean sweep.
const FFPROBE = arg('ffprobe', process.env.FFPROBE || 'ffprobe');
let isStill = /\.(webp|png|jpe?g|gif|bmp)$/i.test(FILE);
try {
  const meta = JSON.parse(execFileSync(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', FILE], { encoding: 'utf8' }));
  const v = meta.streams.find(s => s.codec_type === 'video');
  const dur = parseFloat((meta.format || {}).duration);
  if (v && (['png', 'mjpeg', 'webp'].includes(v.codec_name) || !(dur > 0.5))) isStill = true;
} catch (_) { /* fall back to the extension test */ }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
const extract = isStill
  ? ['-v', 'quiet', '-i', FILE, '-frames:v', '1', path.join(dir, 'f-0001.png')]
  : ['-v', 'quiet', '-i', FILE, '-vf', `fps=${FPS}`, path.join(dir, 'f-%04d.png')];
execFileSync(FFMPEG, extract, { stdio: 'ignore' });
const frames = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
if (!frames.length) { console.error('OCR_NO_FRAMES: extraction produced nothing (still=' + isStill + ')'); process.exit(2); }
console.log('OCR_MODE=' + (isStill ? 'single-frame still' : 'sampled at ' + FPS + ' fps'));

// Things that must never appear in a public clip.
const PATTERNS = [
  ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ['email', /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/],
  ['notification', /\b(notification|new message|incoming call|slack|whatsapp|gmail|inbox)\b/i],
  ['os-dialog', /\b(allow|deny|permission|save file|open file|download failed|do you want to)\b/i],
  ['personal', /\b(password|passcode|api[ _-]?key|token|postcode|sort code|national insurance)\b/i],
  ['devtools', /\b(localhost|127\.0\.0\.1|console|devtools|uncaught)\b/i],
];
const hits = [];
let totalText = 0;
for (const f of frames) {
  const r = spawnSync('tesseract', [path.join(dir, f), 'stdout', '--psm', '6'], { encoding: 'utf8' });
  const text = (r.stdout || '').replace(/\s+/g, ' ').trim();
  totalText += text.length;
  for (const [name, re] of PATTERNS) {
    const m = text.match(re);
    if (m) hits.push({ frame: f, kind: name, match: m[0].slice(0, 60) });
  }
}
fs.rmSync(dir, { recursive: true, force: true });

console.log('OCR_FILE=' + FILE);
console.log('OCR_FRAMES=' + frames.length);
console.log('OCR_TEXT_CHARS=' + totalText);
if (hits.length) {
  console.log('OCR_SWEEP=FAIL');
  for (const h of hits) console.error('  ' + h.kind + ' in ' + h.frame + ': ' + h.match);
  process.exit(1);
}
console.log('OCR_SWEEP=PASS  (no dialogs, IPs, emails, notifications or personal data found)');
