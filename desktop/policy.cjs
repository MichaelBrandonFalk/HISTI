const { fileURLToPath } = require("node:url");
const path = require("node:path");

function isWorkspaceURL(url, indexPath) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "file:" && path.resolve(fileURLToPath(parsed)) === path.resolve(indexPath);
  } catch { return false; }
}

function externalURL(url) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

module.exports = { isWorkspaceURL, externalURL };
