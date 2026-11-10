const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const createResampler = require("../histi_resample.js");
const createPica = require("../vendor/pica.min.js");

test("upscale explicitly selects Lanczos3, no sharpening and no native resize fallback", async () => {
  let instances = 0;
  const calls = [];
  const resampler = createResampler((options) => {
    instances += 1;
    assert.deepEqual(options.features, ["js", "wasm", "ww"]);
    return { resize: async (...args) => { calls.push(args); return args[1]; } };
  });
  const source = { width: 1920, height: 1080 };
  const destination = { width: 3840, height: 2160 };
  assert.equal(await resampler.upscale(source, destination), destination);
  await resampler.upscale(source, destination);
  assert.equal(instances, 1);
  assert.equal(calls[0][0], source);
  assert.deepEqual(calls[0][2], { filter: "lanczos3", unsharpAmount: 0 });
});

test("rejects incorrect upscale dimensions and missing resampler rather than silently degrading", async () => {
  const resampler = createResampler(undefined);
  await assert.rejects(resampler.upscale({ width: 3840, height: 2160 }, { width: 3840, height: 2160 }), /requires/);
  await assert.rejects(resampler.upscale({ width: 1920, height: 1080 }, { width: 2500, height: 2500 }), /requires/);
  await assert.rejects(resampler.upscale({ width: 1920, height: 1080 }, { width: 3840, height: 2160 }), /could not be loaded/);
});

test("square upscale scales height to 3000 then copies an integer centered crop without interpolation", async () => {
  const staged = { width: 0, height: 0 };
  const calls = [];
  const context = { imageSmoothingEnabled: true, drawImage: (...args) => calls.push(args) };
  const destination = { width: 3000, height: 3000, getContext: () => context };
  const source = { width: 1920, height: 1080 };
  const resampler = createResampler(() => ({ resize: async (image, canvas, options) => {
    assert.equal(image, source);
    assert.equal(canvas, staged);
    assert.deepEqual([canvas.width, canvas.height], [5334, 3000]);
    assert.deepEqual(options, { filter: "lanczos3", unsharpAmount: 0 });
  } }), () => staged);
  assert.equal(await resampler.upscale(source, destination), destination);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.deepEqual(calls[0].slice(1), [1167, 0, 3000, 3000, 0, 0, 3000, 3000]);
  assert.equal(calls[0][0], staged);
  assert.deepEqual([staged.width, staged.height], [0, 0]);
});

test("square upscale releases the temporary pixel buffer when resampling fails", async () => {
  const staged = {};
  const resampler = createResampler(() => ({ resize: async () => { throw new Error("test failure"); } }), () => staged);
  await assert.rejects(resampler.upscale({ width: 1920, height: 1080 }, { width: 3000, height: 3000 }), /test failure/);
  assert.deepEqual([staged.width, staged.height], [0, 0]);
});

test("vendored Lanczos3 matches an independent sinc-kernel reference, including edges", async () => {
  const width = 9, height = 7;
  const input = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) input[index + channel] = 64 + ((x * 37 + y * 19 + channel * 43) % 128);
    input[index + 3] = 255;
  }
  const output = await createPica({ features: ["js"] }).resizeBuffer({
    src: input, width, height, toWidth: width * 2, toHeight: height * 2,
    filter: "lanczos3", unsharpAmount: 0,
  });
  const kernel = (distance) => {
    const x = Math.abs(distance);
    if (x < 1e-10) return 1;
    if (x >= 3) return 0;
    return (Math.sin(Math.PI * x) / (Math.PI * x)) * (Math.sin(Math.PI * x / 3) / (Math.PI * x / 3));
  };
  let maxError = 0;
  for (let y = 0; y < height * 2; y += 1) for (let x = 0; x < width * 2; x += 1) {
    const cx = (x + 0.5) / 2 - 0.5;
    const cy = (y + 0.5) / 2 - 0.5;
    for (let channel = 0; channel < 3; channel += 1) {
      let sum = 0, weight = 0;
      for (let sy = Math.max(0, Math.ceil(cy - 3)); sy <= Math.min(height - 1, Math.floor(cy + 3)); sy += 1) {
        for (let sx = Math.max(0, Math.ceil(cx - 3)); sx <= Math.min(width - 1, Math.floor(cx + 3)); sx += 1) {
          const value = kernel(cx - sx) * kernel(cy - sy);
          sum += value * input[(sy * width + sx) * 4 + channel];
          weight += value;
        }
      }
      const expected = Math.max(0, Math.min(255, Math.round(sum / weight)));
      maxError = Math.max(maxError, Math.abs(output[(y * width * 2 + x) * 4 + channel] - expected));
    }
    assert.equal(output[(y * width * 2 + x) * 4 + 3], 255);
  }
  assert.ok(maxError <= 2, `Reference error ${maxError} exceeds rounding tolerance`);
});

test("offline vendor assets exactly match the pinned dependency", () => {
  assert.deepEqual(fs.readFileSync(require.resolve("../vendor/pica.min.js")), fs.readFileSync(require.resolve("pica/dist/pica.min.js")));
  assert.deepEqual(fs.readFileSync(require.resolve("../vendor/pica.LICENSE")), fs.readFileSync(path.resolve(require.resolve("pica/dist/pica.min.js"), "../../LICENSE")));
});
