const assert = require("node:assert/strict");

// Read actual APP/COM bytes without rewriting dimensions during verification.
function metadataSegments(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  const segments = [];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const end = offset + 2 + bytes.readUInt16BE(offset + 2);
    assert.ok(end > offset + 3 && end <= bytes.length);
    if (marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)) segments.push(Uint8Array.from(bytes.subarray(offset, end)));
    offset = end;
  }
  return segments;
}

module.exports = { metadataSegments };
