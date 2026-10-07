export const DPI_PRESETS = Object.freeze([90, 150, 200, 300, 360, 600]);
export const MAX_BATCH_FILES = 500;
export const MAX_CANVAS_EDGE = 16384;
export const MAX_WORKING_BYTES = 1.5 * 1024 ** 3;

export function normalizeDpi(value, fallback = 300) {
  const dpi = Number(value);
  if (!Number.isFinite(dpi)) return fallback;
  return Math.min(600, Math.max(90, Math.round(dpi)));
}

export function sheetPixels(widthMm, heightMm, dpi = 300) {
  const safeDpi = normalizeDpi(dpi);
  const width = Math.max(1, Math.round(Number(widthMm) * safeDpi / 25.4));
  const height = Math.max(1, Math.round(Number(heightMm) * safeDpi / 25.4));
  return { width, height, pixels: width * height, dpi: safeDpi };
}

export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

export function estimateRasterJob({ widthMm, heightMm, dpi = 300, sheets = 1, buffers = 3 } = {}) {
  const dimensions = sheetPixels(widthMm, heightMm, dpi);
  const sheetCount = Math.max(1, Math.trunc(Number(sheets) || 1));
  const workingBuffers = Math.max(1, Math.trunc(Number(buffers) || 1));
  const rgbaBytesPerSheet = dimensions.pixels * 4;
  const peakBytes = rgbaBytesPerSheet * workingBuffers;
  const estimatedOutputBytes = Math.round(rgbaBytesPerSheet * sheetCount * 0.16);
  const warnings = [];
  if (dimensions.width > MAX_CANVAS_EDGE || dimensions.height > MAX_CANVAS_EDGE) warnings.push('canvas-edge');
  if (peakBytes > MAX_WORKING_BYTES) warnings.push('memory');
  if (dimensions.dpi === 600 && sheetCount > 1) warnings.push('queue-one-sheet');
  return {
    ...dimensions,
    sheets: sheetCount,
    rgbaBytesPerSheet,
    peakBytes,
    estimatedOutputBytes,
    safe: !warnings.includes('canvas-edge') && !warnings.includes('memory'),
    warnings
  };
}

export function effectiveDpi(pixelWidth, pixelHeight, targetWidthMm, targetHeightMm) {
  const x = Number(pixelWidth) / (Number(targetWidthMm) / 25.4);
  const y = Number(pixelHeight) / (Number(targetHeightMm) / 25.4);
  if (![x, y].every(Number.isFinite) || x <= 0 || y <= 0) return 0;
  return Math.floor(Math.min(x, y));
}

export function sourceQuality({ pixelWidth, pixelHeight, targetWidthMm, targetHeightMm, requestedDpi = 300 } = {}) {
  const effective = effectiveDpi(pixelWidth, pixelHeight, targetWidthMm, targetHeightMm);
  const requested = normalizeDpi(requestedDpi);
  const ratio = requested ? effective / requested : 0;
  const level = ratio >= 1 ? 'good' : ratio >= 0.72 ? 'warning' : 'low';
  return { effectiveDpi: effective, requestedDpi: requested, ratio, level };
}

export class ProductionQueue {
  constructor({ worker, onProgress = () => {}, onCheckpoint = () => {} } = {}) {
    if (typeof worker !== 'function') throw new TypeError('ProductionQueue requires a worker function');
    this.worker = worker;
    this.onProgress = onProgress;
    this.onCheckpoint = onCheckpoint;
    this.jobs = [];
    this.state = 'idle';
    this.completed = 0;
    this.current = null;
    this._resume = null;
  }

  add(items) {
    const additions = Array.from(items || []);
    if (this.jobs.length + additions.length > MAX_BATCH_FILES) throw new RangeError('Queue supports up to 500 jobs');
    this.jobs.push(...additions);
    this.onProgress(this.snapshot());
    return this.jobs.length;
  }

  pause() {
    if (this.state === 'running') this.state = 'paused';
    this.onProgress(this.snapshot());
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this._resume?.();
    this._resume = null;
    this.onProgress(this.snapshot());
  }

  cancel() {
    this.state = 'cancelled';
    this._resume?.();
    this._resume = null;
    this.onProgress(this.snapshot());
  }

  snapshot() {
    return {
      state: this.state,
      completed: this.completed,
      total: this.completed + this.jobs.length + (this.current ? 1 : 0),
      pending: this.jobs.length,
      current: this.current
    };
  }

  async run() {
    if (this.state === 'running') return this.snapshot();
    if (this.state === 'cancelled') throw new Error('Queue was cancelled');
    this.state = 'running';
    while (this.jobs.length && this.state !== 'cancelled') {
      if (this.state === 'paused') await new Promise(resolve => { this._resume = resolve; });
      if (this.state === 'cancelled') break;
      this.current = this.jobs.shift();
      this.onProgress(this.snapshot());
      await this.worker(this.current, this.snapshot());
      this.completed += 1;
      this.current = null;
      await this.onCheckpoint(this.snapshot());
      this.onProgress(this.snapshot());
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (this.state !== 'cancelled') this.state = 'complete';
    this.onProgress(this.snapshot());
    return this.snapshot();
  }
}
