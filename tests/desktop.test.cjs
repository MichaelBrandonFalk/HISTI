const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { isWorkspaceURL, externalURL } = require("../desktop/policy.cjs");
const root = path.resolve(__dirname, "..");

test("allows only the bundled workspace as in-app navigation", () => {
  const index = path.join(root, "index.html");
  assert.ok(isWorkspaceURL(pathToFileURL(index).href, index));
  assert.ok(isWorkspaceURL(pathToFileURL(index).href + "#outputs", index));
  for (const url of ["https://example.com", "file:///etc/passwd", "javascript:alert(1)", "invalid", pathToFileURL(path.join(root, "README.md")).href]) assert.ok(!isWorkspaceURL(url, index));
});

test("opens only HTTP(S) links in the user's browser", () => {
  assert.equal(externalURL("https://michaelbrandonfalk.github.io/HISTI/"), "https://michaelbrandonfalk.github.io/HISTI/");
  for (const url of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,test", "mailto:test@example.com", "invalid"]) assert.equal(externalURL(url), null);
});

test("aligns release versions, links and desktop resources", () => {
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  const metadata = require("../release_source.json");
  const config = require("../package.json");
  assert.equal(config.version, `${version}.0`);
  assert.equal(metadata.version, `V${version}`);
  assert.equal(metadata.source_tag, `v${version}`);
  assert.equal(metadata.windows_package, config.build.win.artifactName);
  assert.equal(metadata.linux_package, config.build.linux.artifactName);
  const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const name of [metadata.download_package, metadata.windows_package, metadata.linux_package]) assert.ok(page.includes(`/releases/download/${metadata.source_tag}/${name}`));
  for (const file of config.build.extraResources[0].filter) assert.ok(fs.existsSync(path.join(root, file)), file);
});
