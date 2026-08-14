const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../histi_core.js");
const zip = require("../zip_store.js");

test("converts the dimension token and preserves the rest of the name", () => {
  assert.equal(
    core.buildOutputFileName("jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_3840x2160.jpg"),
    "jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_1920x1080.jpg"
  );
});

test("converts a plain dimension filename", () => {
  assert.equal(core.buildOutputFileName("3840x2160.jpg"), "1920x1080.jpg");
});

test("preserves jpeg extension text and converts uppercase source token", () => {
  assert.equal(core.buildOutputFileName("sample_3840X2160.JPEG"), "sample_1920x1080.JPEG");
});

test("rejects files without the source token", () => {
  assert.throws(() => core.buildOutputFileName("sample.jpg"), /3840x2160/);
});

test("rejects non-jpg files", () => {
  assert.throws(() => core.buildOutputFileName("sample_3840x2160.png"), /JPG/);
});

test("validates exact 3840x2160 sources", () => {
  assert.equal(core.validateSourceDimensions(3840, 2160), true);
  assert.throws(() => core.validateSourceDimensions(1920, 1080), /3840x2160/);
});

test("creates a readable stored ZIP blob", async () => {
  const blob = await zip.createZipBlob([
    { name: "one.txt", data: new Uint8Array([111, 110, 101]) },
    { name: "two.txt", data: new Uint8Array([116, 119, 111]) },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.ok(bytes.length > 100);
});
