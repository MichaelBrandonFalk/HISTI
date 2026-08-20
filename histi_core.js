(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HISTI_CORE = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const APP_NAME = "HISTI";
  const DISPLAY_NAME = "Honey, I Shrunk the Images";
  const APP_VERSION = "V1.4";
  const SOURCE_WIDTH = 3840;
  const SOURCE_HEIGHT = 2160;
  const TARGET_WIDTH = 1920;
  const TARGET_HEIGHT = 1080;
  const SQUARE_TARGET_WIDTH = 3000;
  const SQUARE_TARGET_HEIGHT = 3000;
  const SOURCE_TOKEN = "3840x2160";
  const TARGET_TOKEN = "1920x1080";
  const SQUARE_TARGET_TOKEN = "3000x3000";
  const SOURCE_RATIO_TOKEN = "16x9";
  const SQUARE_RATIO_TOKEN = "1x1";
  const JPEG_EXTENSION_RE = /\.(jpe?g)$/i;
  const SOURCE_TOKEN_RE = /3840x2160/gi;
  const SOURCE_TOKEN_FIND_RE = /3840x2160/i;
  const SOURCE_RATIO_TOKEN_RE = /16x9/gi;
  const OUTPUT_TARGETS = [
    {
      id: "16x9",
      label: "16x9 1920x1080",
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      ratioToken: SOURCE_RATIO_TOKEN,
      dimensionToken: TARGET_TOKEN,
      mode: "fit",
    },
    {
      id: "1x1",
      label: "1x1 3000x3000",
      width: SQUARE_TARGET_WIDTH,
      height: SQUARE_TARGET_HEIGHT,
      ratioToken: SQUARE_RATIO_TOKEN,
      dimensionToken: SQUARE_TARGET_TOKEN,
      mode: "cover",
    },
  ];
  const MARKER_SOS = 0xda;
  const MARKER_EOI = 0xd9;
  const MARKER_COM = 0xfe;
  const TYPE_SIZES = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    7: 1,
    9: 4,
    10: 8,
    11: 4,
    12: 8,
  };

  function isJpegFileName(fileName) {
    return JPEG_EXTENSION_RE.test(String(fileName || ""));
  }

  function hasSourceToken(fileName) {
    return SOURCE_TOKEN_FIND_RE.test(String(fileName || ""));
  }

  function getOutputTarget(targetId) {
    const target = OUTPUT_TARGETS.find((candidate) => candidate.id === targetId);
    if (!target) {
      throw new Error(`Unknown output target: ${targetId}.`);
    }
    return target;
  }

  function buildOutputFileName(fileName, targetId = "16x9") {
    const value = String(fileName || "").trim();
    const target = getOutputTarget(targetId);

    if (!value) {
      throw new Error("Missing file name.");
    }

    if (!isJpegFileName(value)) {
      throw new Error("Only JPG files are supported.");
    }

    if (!hasSourceToken(value)) {
      throw new Error("File name must include 3840x2160.");
    }

    const renamed = value.replace(SOURCE_TOKEN_RE, target.dimensionToken);
    if (target.id === "1x1") {
      return renamed.replace(SOURCE_RATIO_TOKEN_RE, target.ratioToken);
    }
    return renamed;
  }

  function validateSourceDimensions(width, height) {
    if (width !== SOURCE_WIDTH || height !== SOURCE_HEIGHT) {
      throw new Error(`Source must be ${SOURCE_WIDTH}x${SOURCE_HEIGHT}. Found ${width}x${height}.`);
    }
    return true;
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  function toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new Error("Expected JPEG bytes.");
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function readUint16BE(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function writeUint16BE(bytes, offset, value) {
    bytes[offset] = (value >>> 8) & 0xff;
    bytes[offset + 1] = value & 0xff;
  }

  function isJpegBytes(bytes) {
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
  }

  function isStandaloneMarker(marker) {
    return marker === 0x01 || marker === 0xd8 || marker === MARKER_EOI || (marker >= 0xd0 && marker <= 0xd7);
  }

  function isMetadataMarker(marker) {
    return marker === MARKER_COM || (marker >= 0xe0 && marker <= 0xef);
  }

  function extractJpegMetadataSegments(input, target = getOutputTarget("16x9")) {
    const bytes = toUint8Array(input);
    const segments = [];

    if (!isJpegBytes(bytes)) {
      return segments;
    }

    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        break;
      }

      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset += 1;
      }

      if (offset >= bytes.length) {
        break;
      }

      const marker = bytes[offset];
      const markerStart = offset - 1;

      if (marker === MARKER_SOS || marker === MARKER_EOI) {
        break;
      }

      if (isStandaloneMarker(marker)) {
        offset += 1;
        continue;
      }

      if (offset + 2 >= bytes.length) {
        break;
      }

      const segmentLength = readUint16BE(bytes, offset + 1);
      if (segmentLength < 2) {
        break;
      }

      const segmentEnd = offset + 1 + segmentLength;
      if (segmentEnd > bytes.length) {
        break;
      }

      if (isMetadataMarker(marker)) {
        segments.push(sanitizeMetadataSegment(bytes.slice(markerStart, segmentEnd), target));
      }

      offset = segmentEnd;
    }

    return segments;
  }

  function leadingMetadataEnd(bytes) {
    if (!isJpegBytes(bytes)) {
      throw new Error("Output is not a valid JPEG.");
    }

    let offset = 2;
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset += 1;
      }

      if (offset >= bytes.length) {
        break;
      }

      const marker = bytes[offset];
      if (!isMetadataMarker(marker) || marker === MARKER_SOS || marker === MARKER_EOI) {
        return offset - 1;
      }

      const segmentLength = readUint16BE(bytes, offset + 1);
      if (segmentLength < 2) {
        return offset - 1;
      }

      const segmentEnd = offset + 1 + segmentLength;
      if (segmentEnd > bytes.length) {
        return offset - 1;
      }

      offset = segmentEnd;
    }

    return offset;
  }

  function mergeJpegMetadata(outputJpeg, sourceJpeg, target = getOutputTarget("16x9")) {
    const outputBytes = toUint8Array(outputJpeg);
    const metadataSegments = extractJpegMetadataSegments(sourceJpeg, target);

    if (metadataSegments.length === 0) {
      return outputBytes.slice();
    }

    const tailStart = leadingMetadataEnd(outputBytes);
    return concatBytes([outputBytes.slice(0, 2), ...metadataSegments, outputBytes.slice(tailStart)]);
  }

  function sanitizeMetadataSegment(segment, target = getOutputTarget("16x9")) {
    const marker = segment[1];
    if (marker !== 0xe1) {
      return segment;
    }

    const payload = segment.subarray(4);
    if (startsWithAscii(payload, "Exif\0\0")) {
      return patchExifSegment(segment, target);
    }

    if (containsAscii(payload, "http://ns.adobe.com/xap/1.0/") || containsAscii(payload, "<x:xmpmeta")) {
      return patchXmpSegment(segment, target);
    }

    return segment;
  }

  function startsWithAscii(bytes, text) {
    if (bytes.length < text.length) {
      return false;
    }
    for (let index = 0; index < text.length; index += 1) {
      if (bytes[index] !== text.charCodeAt(index)) {
        return false;
      }
    }
    return true;
  }

  function containsAscii(bytes, text) {
    const needle = asciiBytes(text);
    outer:
    for (let index = 0; index <= bytes.length - needle.length; index += 1) {
      for (let needleIndex = 0; needleIndex < needle.length; needleIndex += 1) {
        if (bytes[index + needleIndex] !== needle[needleIndex]) {
          continue outer;
        }
      }
      return true;
    }
    return false;
  }

  function asciiBytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index] = text.charCodeAt(index);
    }
    return bytes;
  }

  function patchXmpSegment(segment, target) {
    const prefix = segment.slice(0, 4);
    const payloadText = decodeUtf8(segment.subarray(4));
    const patchedText = payloadText
      .replace(/((?:(?:tiff:)?ImageWidth|(?:exif:)?PixelXDimension)\s*=\s*["'])\d+(["'])/g, `$1${target.width}$2`)
      .replace(/((?:(?:tiff:)?(?:ImageLength|ImageHeight)|(?:exif:)?PixelYDimension)\s*=\s*["'])\d+(["'])/g, `$1${target.height}$2`)
      .replace(/(<(?:(?:tiff:)?ImageWidth|(?:exif:)?PixelXDimension)>)[^<]*(<\/[^>]+>)/g, `$1${target.width}$2`)
      .replace(/(<(?:(?:tiff:)?(?:ImageLength|ImageHeight)|(?:exif:)?PixelYDimension)>)[^<]*(<\/[^>]+>)/g, `$1${target.height}$2`);
    const payloadBytes = encodeUtf8(patchedText);
    const length = payloadBytes.length + 2;

    if (length > 0xffff) {
      return segment;
    }

    const patched = new Uint8Array(payloadBytes.length + 4);
    patched.set(prefix, 0);
    writeUint16BE(patched, 2, length);
    patched.set(payloadBytes, 4);
    return patched;
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(bytes);
    }

    let text = "";
    bytes.forEach((byte) => {
      text += String.fromCharCode(byte);
    });
    return decodeURIComponent(escape(text));
  }

  function encodeUtf8(text) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text);
    }

    const encoded = unescape(encodeURIComponent(text));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes;
  }

  function patchExifSegment(segment, target) {
    const patched = segment.slice();
    const tiffStart = 10;

    if (patched.length < tiffStart + 8) {
      return patched;
    }

    const byteOrder = String.fromCharCode(patched[tiffStart], patched[tiffStart + 1]);
    const littleEndian = byteOrder === "II";
    if (!littleEndian && byteOrder !== "MM") {
      return patched;
    }

    const read16 = (offset) => littleEndian
      ? patched[offset] | (patched[offset + 1] << 8)
      : (patched[offset] << 8) | patched[offset + 1];
    const read32 = (offset) => littleEndian
      ? (patched[offset] | (patched[offset + 1] << 8) | (patched[offset + 2] << 16) | (patched[offset + 3] << 24)) >>> 0
      : (((patched[offset] << 24) >>> 0) | (patched[offset + 1] << 16) | (patched[offset + 2] << 8) | patched[offset + 3]) >>> 0;
    const write16 = (offset, value) => {
      if (littleEndian) {
        patched[offset] = value & 0xff;
        patched[offset + 1] = (value >>> 8) & 0xff;
      } else {
        patched[offset] = (value >>> 8) & 0xff;
        patched[offset + 1] = value & 0xff;
      }
    };
    const write32 = (offset, value) => {
      if (littleEndian) {
        patched[offset] = value & 0xff;
        patched[offset + 1] = (value >>> 8) & 0xff;
        patched[offset + 2] = (value >>> 16) & 0xff;
        patched[offset + 3] = (value >>> 24) & 0xff;
      } else {
        patched[offset] = (value >>> 24) & 0xff;
        patched[offset + 1] = (value >>> 16) & 0xff;
        patched[offset + 2] = (value >>> 8) & 0xff;
        patched[offset + 3] = value & 0xff;
      }
    };

    if (read16(tiffStart + 2) !== 42) {
      return patched;
    }

    const visited = new Set();
    const updateIfd = (ifdRelativeOffset) => {
      if (!ifdRelativeOffset || visited.has(ifdRelativeOffset)) {
        return 0;
      }
      visited.add(ifdRelativeOffset);

      const ifdOffset = tiffStart + ifdRelativeOffset;
      if (ifdOffset < tiffStart || ifdOffset + 2 > patched.length) {
        return 0;
      }

      const count = read16(ifdOffset);
      const entriesStart = ifdOffset + 2;
      const entriesEnd = entriesStart + count * 12;
      if (entriesEnd + 4 > patched.length) {
        return 0;
      }

      for (let index = 0; index < count; index += 1) {
        const entry = entriesStart + index * 12;
        const tag = read16(entry);
        if (tag === 0x0100 || tag === 0xa002) {
          updateExifEntryValue(entry, target.width, read16, read32, write16, write32, tiffStart, patched.length);
        } else if (tag === 0x0101 || tag === 0xa003) {
          updateExifEntryValue(entry, target.height, read16, read32, write16, write32, tiffStart, patched.length);
        } else if (tag === 0x8769) {
          updateIfd(read32(entry + 8));
        }
      }

      return read32(entriesEnd);
    };

    const firstIfdOffset = read32(tiffStart + 4);
    const nextIfdOffset = updateIfd(firstIfdOffset);
    if (nextIfdOffset) {
      updateIfd(nextIfdOffset);
    }

    return patched;
  }

  function updateExifEntryValue(entry, value, read16, read32, write16, write32, tiffStart, maxLength) {
    const type = read16(entry + 2);
    const count = read32(entry + 4);
    const typeSize = TYPE_SIZES[type];

    if (!typeSize || count !== 1) {
      return;
    }

    const valueOffset = typeSize <= 4 ? entry + 8 : tiffStart + read32(entry + 8);
    if (valueOffset < tiffStart || valueOffset + typeSize > maxLength) {
      return;
    }

    if (type === 3) {
      write16(valueOffset, value);
    } else if (type === 4 || type === 9) {
      write32(valueOffset, value);
    }
  }

  return {
    APP_NAME,
    DISPLAY_NAME,
    APP_VERSION,
    SOURCE_WIDTH,
    SOURCE_HEIGHT,
    TARGET_WIDTH,
    TARGET_HEIGHT,
    SQUARE_TARGET_WIDTH,
    SQUARE_TARGET_HEIGHT,
    SOURCE_TOKEN,
    TARGET_TOKEN,
    SQUARE_TARGET_TOKEN,
    OUTPUT_TARGETS,
    buildOutputFileName,
    extractJpegMetadataSegments,
    formatBytes,
    getOutputTarget,
    isJpegFileName,
    mergeJpegMetadata,
    validateSourceDimensions,
  };
});
