import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DPI_PRESETS, MAX_BATCH_FILES, ProductionQueue, effectiveDpi,
  estimateRasterJob, normalizeDpi, sheetPixels, sourceQuality
} from '../production-runtime.mjs';

test('production DPI is bounded to the supported 90-600 range', () => {
  assert.deepEqual(DPI_PRESETS, [90, 150, 200, 300, 360, 600]);
  assert.equal(normalizeDpi(10), 90);
  assert.equal(normalizeDpi(2400), 600);
  assert.equal(normalizeDpi('360'), 360);
});

test('sheet estimates expose final pixels, memory and unsafe canvas edges', () => {
  assert.deepEqual(sheetPixels(25.4, 25.4, 300), {width:300, height:300, pixels:90000, dpi:300});
  const a4 = estimateRasterJob({widthMm:210, heightMm:297, dpi:300, sheets:2});
  assert.equal(a4.safe, true);
  assert.ok(a4.rgbaBytesPerSheet > 30_000_000);
  const large = estimateRasterJob({widthMm:330.2, heightMm:482.6, dpi:600, sheets:2});
  assert.equal(large.safe, true);
  assert.ok(large.warnings.includes('queue-one-sheet'));
});

test('effective DPI and quality warnings use the placed physical size', () => {
  assert.equal(effectiveDpi(1200, 600, 101.6, 50.8), 300);
  assert.equal(sourceQuality({pixelWidth:1200,pixelHeight:600,targetWidthMm:101.6,targetHeightMm:50.8,requestedDpi:300}).level, 'good');
  assert.equal(sourceQuality({pixelWidth:400,pixelHeight:200,targetWidthMm:101.6,targetHeightMm:50.8,requestedDpi:300}).level, 'low');
});

test('production queue processes 500 jobs sequentially and enforces the limit', async () => {
  const order = [];
  const queue = new ProductionQueue({worker:async value => order.push(value)});
  queue.add(Array.from({length:MAX_BATCH_FILES}, (_, index) => index));
  assert.throws(() => queue.add([501]), /500 jobs/);
  const result = await queue.run();
  assert.equal(result.state, 'complete');
  assert.equal(result.completed, 500);
  assert.deepEqual(order.slice(0, 3), [0, 1, 2]);
  assert.deepEqual(order.slice(-3), [497, 498, 499]);
});
