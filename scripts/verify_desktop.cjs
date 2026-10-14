const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const asar = require("@electron/asar");
const root = path.resolve(__dirname, "..");
const executable = process.argv[2];
assert.ok(executable, "Pass the installed or unpacked application executable");
const resources = process.platform === "darwin"
  ? path.resolve(executable, "../../Resources") : path.join(path.dirname(executable), "resources");
const files = require("../package.json").build.extraResources[0].filter;
for (const file of files) {
  assert.deepEqual(fs.readFileSync(path.join(resources, "site", file)), fs.readFileSync(path.join(root, file)), `${file} differs from versioned source`);
}
for (const file of ["desktop/main.cjs", "desktop/preload.cjs", "desktop/policy.cjs"]) {
  assert.deepEqual(asar.extractFile(path.join(resources, "app.asar"), file), fs.readFileSync(path.join(root, file)), `${file} differs from wrapper source`);
}
console.log(`PASS: ${files.length} shared files and all desktop wrapper files match the versioned source`);
