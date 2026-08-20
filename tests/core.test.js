const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../histi_core.js");
const zip = require("../zip_store.js");

test("exposes the V1.4 display metadata", () => {
  assert.equal(core.APP_VERSION, "V1.4");
  assert.equal(core.DISPLAY_NAME, "Honey, I Shrunk the Images");
});

test("converts the dimension token for the 16x9 output", () => {
  assert.equal(
    core.buildOutputFileName("jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_3840x2160.jpg"),
    "jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_1920x1080.jpg"
  );
});

test("converts the ratio and dimension tokens for the 1x1 output", () => {
  assert.equal(
    core.buildOutputFileName("jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_3840x2160.jpg", "1x1"),
    "jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_1x1_3000x3000.jpg"
  );
});

test("converts a plain dimension filename", () => {
  assert.equal(core.buildOutputFileName("3840x2160.jpg"), "1920x1080.jpg");
  assert.equal(core.buildOutputFileName("3840x2160.jpg", "1x1"), "3000x3000.jpg");
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

test("copies JPEG metadata and updates XMP dimensions", () => {
  const source = jpeg(
    segment(0xe0, ascii("JFIF\0source-density")),
    segment(0xfe, ascii("operator note")),
    segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta tiff:ImageWidth="3840" tiff:ImageLength="2160" exif:PixelXDimension="3840" exif:PixelYDimension="2160">keep</x:xmpmeta>'))
  );
  const output = jpeg(
    segment(0xe0, ascii("JFIF\0canvas-density")),
    segment(0xdb, new Uint8Array([0, 0]))
  );
  const merged = core.mergeJpegMetadata(output, source);
  const text = asciiFromBytes(merged);

  assert.match(text, /operator note/);
  assert.match(text, /source-density/);
  assert.doesNotMatch(text, /canvas-density/);
  assert.match(text, /tiff:ImageWidth="1920"/);
  assert.match(text, /tiff:ImageLength="1080"/);
  assert.match(text, /exif:PixelXDimension="1920"/);
  assert.match(text, /exif:PixelYDimension="1080"/);
});

test("copies JPEG metadata and updates XMP dimensions for square output", () => {
  const source = jpeg(
    segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta tiff:ImageWidth="3840" tiff:ImageLength="2160" exif:PixelXDimension="3840" exif:PixelYDimension="2160">keep</x:xmpmeta>'))
  );
  const output = jpeg(segment(0xdb, new Uint8Array([0, 0])));
  const merged = core.mergeJpegMetadata(output, source, core.getOutputTarget("1x1"));
  const text = asciiFromBytes(merged);

  assert.match(text, /tiff:ImageWidth="3000"/);
  assert.match(text, /tiff:ImageLength="3000"/);
  assert.match(text, /exif:PixelXDimension="3000"/);
  assert.match(text, /exif:PixelYDimension="3000"/);
});

test("updates EXIF dimension tags while preserving other EXIF bytes", () => {
  const exif = exifSegment();
  const source = jpeg(exif);
  const output = jpeg(segment(0xdb, new Uint8Array([0, 0])));
  const merged = core.mergeJpegMetadata(output, source);
  const exifStart = findSubarray(merged, ascii("Exif\0\0")) - 4;

  assert.ok(exifStart >= 0);
  assert.equal(readLe32(merged, exifStart + 10 + 8 + 2 + 8), 1920);
  assert.equal(readLe32(merged, exifStart + 10 + 8 + 14 + 8), 1080);
  assert.equal(readLe32(merged, exifStart + 10 + 50 + 2 + 8), 1920);
  assert.equal(readLe32(merged, exifStart + 10 + 50 + 14 + 8), 1080);
});

test("updates EXIF dimension tags for square output", () => {
  const source = jpeg(exifSegment());
  const output = jpeg(segment(0xdb, new Uint8Array([0, 0])));
  const merged = core.mergeJpegMetadata(output, source, core.getOutputTarget("1x1"));
  const exifStart = findSubarray(merged, ascii("Exif\0\0")) - 4;

  assert.ok(exifStart >= 0);
  assert.equal(readLe32(merged, exifStart + 10 + 8 + 2 + 8), 3000);
  assert.equal(readLe32(merged, exifStart + 10 + 8 + 14 + 8), 3000);
  assert.equal(readLe32(merged, exifStart + 10 + 50 + 2 + 8), 3000);
  assert.equal(readLe32(merged, exifStart + 10 + 50 + 14 + 8), 3000);
});

function ascii(text) {
  return new TextEncoder().encode(text);
}

function asciiFromBytes(bytes) {
  return new TextDecoder().decode(bytes);
}

function segment(marker, payload) {
  const bytes = new Uint8Array(payload.length + 4);
  bytes[0] = 0xff;
  bytes[1] = marker;
  bytes[2] = ((payload.length + 2) >>> 8) & 0xff;
  bytes[3] = (payload.length + 2) & 0xff;
  bytes.set(payload, 4);
  return bytes;
}

function jpeg(...segments) {
  return concat([
    new Uint8Array([0xff, 0xd8]),
    ...segments,
    new Uint8Array([0xff, 0xda, 0x00, 0x08, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9]),
  ]);
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function exifSegment() {
  const payload = new Uint8Array(6 + 80);
  payload.set(ascii("Exif\0\0"), 0);
  const tiff = 6;
  payload[tiff] = 0x49;
  payload[tiff + 1] = 0x49;
  writeLe16(payload, tiff + 2, 42);
  writeLe32(payload, tiff + 4, 8);

  const ifd0 = tiff + 8;
  writeLe16(payload, ifd0, 3);
  writeEntry(payload, ifd0 + 2, 0x0100, 3840);
  writeEntry(payload, ifd0 + 14, 0x0101, 2160);
  writeEntry(payload, ifd0 + 26, 0x8769, 50);
  writeLe32(payload, ifd0 + 38, 0);

  const exifIfd = tiff + 50;
  writeLe16(payload, exifIfd, 2);
  writeEntry(payload, exifIfd + 2, 0xa002, 3840);
  writeEntry(payload, exifIfd + 14, 0xa003, 2160);
  writeLe32(payload, exifIfd + 26, 0);

  return segment(0xe1, payload);
}

function writeEntry(bytes, offset, tag, value) {
  writeLe16(bytes, offset, tag);
  writeLe16(bytes, offset + 2, 4);
  writeLe32(bytes, offset + 4, 1);
  writeLe32(bytes, offset + 8, value);
}

function writeLe16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeLe32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function readLe32(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function findSubarray(haystack, needle) {
  outer:
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let needleIndex = 0; needleIndex < needle.length; needleIndex += 1) {
      if (haystack[index + needleIndex] !== needle[needleIndex]) {
        continue outer;
      }
    }
    return index;
  }
  return -1;
}
