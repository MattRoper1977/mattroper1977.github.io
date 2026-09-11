// REFERENCE ONLY — NOT FOR COPY — SEE DEFECT LIST
/* ==========================================================================
   THIRD-PARTY SUPPLIED SOURCE — ghost telemetry codec
   Provided 2026-09-11. Reproduced verbatim for audit. Not for copy.

   Stated design: three-stage compression pipeline to fit a 60-second ghost
   run into a sub-500-character URL hash using zero libraries.
     1. Quantisation & implicit timing — sample at 10 Hz (100 ms), drop
        timestamps (time derived from frame index), quantise coordinates to
        16-bit unsigned integers and rotation to an 8-bit byte.
     2. Binary packing — contiguous Uint8Array, 5 bytes per sample
        (2 X, 2 Y, 1 angle).
     3. Deflate + URL-safe Base64 via native CompressionStream('deflate-raw'),
        with - and _ replacing + and /.

   Stated data footprint:
     15 s · 150 frames ·   754 B raw · ~90–140 chars   · fits inside QR codes
     45 s · 450 frames · 2,254 B raw · ~260–380 chars  · pasteable into chat
     90 s · 900 frames · 4,504 B raw · ~480–720 chars  · under a 2,048 ceiling
   ========================================================================== */

const TelemetryCodec = {
  SAMPLE_RATE_HZ: 10,
  INTERVAL_MS: 100,

  // Coordinate space bounds (adjust to match your map/track size)
  WORLD_BOUNDS: { minX: 0, maxX: 2000, minY: 0, maxY: 2000 },

  /**
   * Pack recorded samples: [{x, y, angle}]
   * Byte layout per frame: [X: Uint16 (2B)] [Y: Uint16 (2B)] [Rot: Uint8 (1B)] = 5 Bytes
   */
  packBinary(samples) {
    const frameCount = samples.length;
    // 4-byte header (frameCount: Uint16, lapTimeTenths: Uint16) + 5 bytes per frame
    const buffer = new ArrayBuffer(4 + frameCount * 5);
    const view = new DataView(buffer);

    view.setUint16(0, frameCount, true);
    view.setUint16(2, Math.round((frameCount * this.INTERVAL_MS) / 100), true);

    const { minX, maxX, minY, maxY } = this.WORLD_BOUNDS;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    let offset = 4;
    for (let i = 0; i < frameCount; i++) {
      const s = samples[i];
      // Normalize 0.0 - 1.0, then scale to 16-bit uint (0 - 65535)
      const qX = Math.max(0, Math.min(65535, Math.round(((s.x - minX) / rangeX) * 65535)));
      const qY = Math.max(0, Math.min(65535, Math.round(((s.y - minY) / rangeY) * 65535)));

      // Normalize angle [0, 2PI) to 8-bit uint (0 - 255)
      const normAngle = ((s.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const qRot = Math.round((normAngle / (Math.PI * 2)) * 255) & 0xFF;

      view.setUint16(offset, qX, true);
      view.setUint16(offset + 2, qY, true);
      view.setUint8(offset + 4, qRot);
      offset += 5;
    }

    return new Uint8Array(buffer);
  },

  /**
   * Unpack raw binary back into playable sample frames
   */
  unpackBinary(uint8Array) {
    const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
    const frameCount = view.getUint16(0, true);
    const { minX, maxX, minY, maxY } = this.WORLD_BOUNDS;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    const samples = [];
    let offset = 4;

    for (let i = 0; i < frameCount; i++) {
      const qX = view.getUint16(offset, true);
      const qY = view.getUint16(offset + 2, true);
      const qRot = view.getUint8(offset + 4);

      samples.push({
        x: minX + (qX / 65535) * rangeX,
        y: minY + (qY / 65535) * rangeY,
        angle: (qRot / 255) * (Math.PI * 2)
      });
      offset += 5;
    }

    return samples;
  },

  /**
   * Compress binary buffer to URL-Safe Base64 string via native streams
   */
  async encodeToHash(samples) {
    const packed = this.packBinary(samples);

    // Native deflate compression (no zlib headers)
    const stream = new Blob([packed]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
    const compressedBuffer = await new Response(compressedStream).arrayBuffer();

    // Uint8 to binary string
    const bytes = new Uint8Array(compressedBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    // URL-safe Base64: swap '+' -> '-', '/' -> '_', drop '=' padding
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },

  /**
   * Decompress URL-Safe Base64 string back into sample points
   */
  async decodeFromHash(hashString) {
    // Restore base64 standard characters and padding
    let b64 = hashString.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Native inflate decompression
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate-raw'));
    const arrayBuffer = await new Response(decompressedStream).arrayBuffer();

    return this.unpackBinary(new Uint8Array(arrayBuffer));
  }
};

/* --------------------------------------------------------------------------
   In-Game Telemetry Recorder & Ghost Player
   -------------------------------------------------------------------------- */

class GhostController {
  constructor() {
    this.recordedSamples = [];
    this.ghostSamples = [];
    this.accumulatedTime = 0;
    this.playbackTime = 0;
  }

  // Call on race reset/start
  startRecording() {
    this.recordedSamples = [];
    this.accumulatedTime = 0;
  }

  // Call every game frame during a run
  recordTick(dt, playerEntity) {
    this.accumulatedTime += dt;
    const interval = TelemetryCodec.INTERVAL_MS / 1000;

    // Fixed 10Hz sampling
    while (this.accumulatedTime >= interval) {
      this.recordedSamples.push({
        x: playerEntity.x,
        y: playerEntity.y,
        angle: playerEntity.angle
      });
      this.accumulatedTime -= interval;
    }
  }

  // Load a rival ghost run from window.location.hash
  async initGhostFromUrl() {
    const hash = window.location.hash;
    if (hash.startsWith('#ghost=')) {
      const code = hash.slice(7);
      try {
        this.ghostSamples = await TelemetryCodec.decodeFromHash(code);
        console.log(`Ghost loaded: ${this.ghostSamples.length} samples.`);
        return true;
      } catch (err) {
        console.error('Failed to parse ghost telemetry:', err);
      }
    }
    return false;
  }

  // Generate share link on finish line
  async getShareableUrl() {
    const hash = await TelemetryCodec.encodeToHash(this.recordedSamples);
    const base = window.location.origin + window.location.pathname;
    return `${base}#ghost=${hash}`;
  }

  // Sample ghost state at current elapsed race time with interpolation
  getGhostState(elapsedTime) {
    if (!this.ghostSamples.length) return null;

    const interval = TelemetryCodec.INTERVAL_MS / 1000;
    const exactFrame = elapsedTime / interval;
    const indexA = Math.floor(exactFrame);
    const indexB = indexA + 1;
    const alpha = exactFrame - indexA;

    if (indexA >= this.ghostSamples.length - 1) {
      return this.ghostSamples[this.ghostSamples.length - 1]; // Parked at finish
    }

    const a = this.ghostSamples[indexA];
    const b = this.ghostSamples[indexB];

    // Shortest-path angle interpolation
    let dAngle = (b.angle - a.angle) % (Math.PI * 2);
    if (dAngle > Math.PI) dAngle -= Math.PI * 2;
    if (dAngle < -Math.PI) dAngle += Math.PI * 2;

    return {
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      angle: a.angle + dAngle * alpha
    };
  }
}

/* --------------------------------------------------------------------------
   Drawing the Rival Ghost in Canvas
   -------------------------------------------------------------------------- */

function renderGhost(ctx, ghostState) {
  if (!ghostState) return;

  ctx.save();
  ctx.translate(ghostState.x, ghostState.y);
  ctx.rotate(ghostState.angle);

  // Translucent wireframe styling
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#38bdf8';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 2;

  // Simple triangle car/runner footprint
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-12, -8);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
