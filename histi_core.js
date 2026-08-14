(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HISTI_CORE = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const APP_NAME = "HISTI";
  const DISPLAY_NAME = "Honey I Shrunk The Images";
  const APP_VERSION = "V1.1";
  const SOURCE_WIDTH = 3840;
  const SOURCE_HEIGHT = 2160;
  const TARGET_WIDTH = 1920;
  const TARGET_HEIGHT = 1080;
  const SOURCE_TOKEN = "3840x2160";
  const TARGET_TOKEN = "1920x1080";
  const JPEG_EXTENSION_RE = /\.(jpe?g)$/i;
  const SOURCE_TOKEN_RE = /3840x2160/gi;
  const SOURCE_TOKEN_FIND_RE = /3840x2160/i;

  function isJpegFileName(fileName) {
    return JPEG_EXTENSION_RE.test(String(fileName || ""));
  }

  function hasSourceToken(fileName) {
    return SOURCE_TOKEN_FIND_RE.test(String(fileName || ""));
  }

  function buildOutputFileName(fileName) {
    const value = String(fileName || "").trim();

    if (!value) {
      throw new Error("Missing file name.");
    }

    if (!isJpegFileName(value)) {
      throw new Error("Only JPG files are supported.");
    }

    if (!hasSourceToken(value)) {
      throw new Error("File name must include 3840x2160.");
    }

    return value.replace(SOURCE_TOKEN_RE, TARGET_TOKEN);
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

  return {
    APP_NAME,
    DISPLAY_NAME,
    APP_VERSION,
    SOURCE_WIDTH,
    SOURCE_HEIGHT,
    TARGET_WIDTH,
    TARGET_HEIGHT,
    SOURCE_TOKEN,
    TARGET_TOKEN,
    buildOutputFileName,
    formatBytes,
    isJpegFileName,
    validateSourceDimensions,
  };
});
