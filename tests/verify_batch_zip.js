const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../histi_core.js");
const { crc32 } = require("../zip_store.js");

const [archive, fixtures, mode = "both"] = process.argv.slice(2);
assert.ok(["both", "16x9", "1x1"].includes(mode));
const targets = core.OUTPUT_TARGETS.filter((target) => mode === "both" || target.id === mode);
const expected = new Map();
for (const name of fs.readdirSync(fixtures).filter((name) => /\.jpg$/.test(name))) {
  for (const target of targets) expected.set(core.buildOutputFileName(name, target.id), { name, target });
}

function dimensions(bytes) {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1];
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    assert.notEqual(marker, 0xda, "Image has no dimensions before scan data");
    offset += bytes.readUInt16BE(offset + 2) + 2;
  }
  throw new Error("No JPEG dimensions");
}

const fd = fs.openSync(archive, "r");
let offset = 0;
let count = 0;
let payloadSize = 0;
const seen = new Set();
try {
  while (true) {
    const header = Buffer.alloc(30);
    assert.equal(fs.readSync(fd, header, 0, 30, offset), 30);
    if (header.readUInt32LE(0) === 0x02014b50) break;
    assert.equal(header.readUInt32LE(0), 0x04034b50);
    assert.equal(header.readUInt16LE(8), 0, "Expected stored ZIP entries");
    const length = header.readUInt32LE(18);
    const nameLength = header.readUInt16LE(26);
    const extraLength = header.readUInt16LE(28);
    const nameBytes = Buffer.alloc(nameLength);
    fs.readSync(fd, nameBytes, 0, nameLength, offset + 30);
    const name = nameBytes.toString("utf8");
    const input = expected.get(name);
    assert.ok(input, `Unexpected output: ${name}`);
    assert.ok(!seen.has(name), `Duplicate output: ${name}`);
    seen.add(name);
    const bytes = Buffer.alloc(length);
    assert.equal(fs.readSync(fd, bytes, 0, length, offset + 30 + nameLength + extraLength), length);
    assert.equal(crc32(bytes), header.readUInt32LE(14), `${name}: CRC mismatch`);
    assert.deepEqual(dimensions(bytes), [input.target.width, input.target.height], `${name}: wrong dimensions`);
    const source = fs.readFileSync(path.join(fixtures, input.name));
    assert.deepEqual(core.extractJpegMetadataSegments(bytes, input.target), core.extractJpegMetadataSegments(source, input.target), `${name}: metadata changed`);
    offset += 30 + nameLength + extraLength + length;
    count += 1;
    payloadSize += length;
  }
  assert.equal(count, 100 * targets.length);
  assert.equal(seen.size, expected.size);
  console.log(`PASS: all ${count} JPGs have correct filenames, dimensions, CRCs and preserved metadata (${(payloadSize / 1024 / 1024).toFixed(1)} MB)`);
} finally {
  fs.closeSync(fd);
}
