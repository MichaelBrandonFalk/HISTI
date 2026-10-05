const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const files = ["index.html", "styles.css", "app.js", "histi_core.js", "zip_store.js", "site.webmanifest",
  "release_source.json", "README.md", "CHANGELOG.md", "VERSION", "assets/histi_icon.png"];
const packages = [
  ["HISTI.V1_5.macOS.zip", "HISTI.app/Contents/Resources/site"],
  ["HISTI.V1_5.web.zip", "HISTI V1_5 Web"],
];

for (const [name, prefix] of packages) {
  const archive = path.join(root, "downloads", name);
  execFileSync("unzip", ["-t", archive], { stdio: "pipe" });
  for (const file of files) {
    const packaged = execFileSync("unzip", ["-p", archive, `${prefix}/${file}`], { maxBuffer: 10 * 1024 * 1024 });
    assert.deepEqual(packaged, fs.readFileSync(path.join(root, file)), `${name}: ${file} differs from source`);
  }
  console.log(`${name}: all ${files.length} shared files match the hosted source byte-for-byte`);
}
