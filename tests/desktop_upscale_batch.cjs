const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { _electron } = require("playwright");
const core = require("../histi_core.js");
const { withMetadata } = require("./upscale_fixture.cjs");
const { metadataSegments } = require("./jpeg_checks.cjs");
const root = path.resolve(__dirname, "..");
const mode = process.argv[3] || "both";
assert.ok(["both", "landscape", "square"].includes(mode));
const targets = core.getOutputTargets("upscale").filter((target) => mode === "both" || target.id === (mode === "landscape" ? "upscale" : "upscale-square"));
const screenshots = path.join(root, "output", "desktop-upscale", process.platform);
const output = path.join(screenshots, mode);
const fixtures = path.join(output, "fixtures");
fs.mkdirSync(fixtures, { recursive: true });

async function main() {
  const executable = process.argv[2];
  const application = await _electron.launch({ executablePath: executable || require("electron"), args: executable ? [] : [root], timeout: 60000 });
  try {
    const page = await application.firstWindow({ timeout: 60000 });
    await application.evaluate(({ dialog }) => {
      globalThis.upscaleErrors = [];
      dialog.showErrorBox = (title, message) => globalThis.upscaleErrors.push(`${title}: ${message}`);
    });
    await page.waitForFunction(() => window.HISTI_CORE?.APP_VERSION === "V1.10");
    await page.locator("#direction-upscale").check();
    if (mode === "landscape") await page.locator("#upscale-square").uncheck();
    if (mode === "square") await page.locator("#upscale-landscape").uncheck();
    const jpeg = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1920; canvas.height = 1080;
      const context = canvas.getContext("2d");
      for (let y = 0; y < 1080; y += 24) for (let x = 0; x < 1920; x += 24) {
        context.fillStyle = `rgb(${(x * 7 + y) % 256},${(y * 3 + x) % 256},${(x + y * 5) % 256})`;
        context.fillRect(x, y, 24, 24);
      }
      return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
    }), "base64");
    const source = withMetadata(jpeg);
    const paths = [];
    for (let i = 0; i < 100; i += 1) {
      const name = i < 50 ? `up_${String(i).padStart(3, "0")}_16x9_1920x1080.jpg` : `up_plain_${i}.jpg`;
      const file = path.join(fixtures, name);
      fs.writeFileSync(file, source); paths.push(file);
    }
    const png = path.join(fixtures, "skipped.png");
    fs.writeFileSync(png, "not a JPG");
    await page.locator("#file-input").setInputFiles([...paths, png]);
    assert.equal(await page.locator("#results-body tr").count(), 100 * targets.length + 1);
    assert.equal(await page.locator("#error-count").textContent(), "1");
    assert.ok(await page.locator("#direction-shrink").isDisabled());
    console.log(`Upscaling 100 JPGs with Lanczos3 (${mode})...`);
    await page.locator("#process-button").click();
    await page.waitForFunction((count) => document.querySelector("#ready-count").textContent === String(count)
      && document.querySelector("#process-button").textContent === "Process", 100 * targets.length, { timeout: 600000 });
    await application.evaluate(({ BrowserWindow }, directory) => {
      globalThis.upscaleDownloads = [];
      BrowserWindow.getAllWindows()[0].webContents.session.on("will-download", (_event, item) => {
        item.setSavePath(directory + "/" + item.getFilename());
        item.once("done", (_event, state) => globalThis.upscaleDownloads.push({ name: item.getFilename(), state }));
      });
    }, output);
    const waitForSaves = async (count) => {
      for (let i = 0; ; i += 1) {
        const { saved, errors } = await application.evaluate(() => ({ saved: globalThis.upscaleDownloads, errors: globalThis.upscaleErrors }));
        assert.equal(errors.length, 0, errors.join("; "));
        if (saved.length >= count) { assert.ok(saved.every((file) => file.state === "completed")); return; }
        assert.ok(i < 1200, "Timed out saving upscale outputs");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    await page.locator("#download-all-button").click();
    await waitForSaves(1);
    execFileSync(process.execPath, [path.join(__dirname, "verify_batch_zip.js"), path.join(output, "HISTI_V1_10_upscaled_outputs.zip"), fixtures, mode === "both" ? "upscale" : `upscale-${mode}`], { stdio: "inherit" });
    console.log("Verified upscale ZIP; saving an individual JPG...");
    await page.locator("#results-body button").first().click();
    await waitForSaves(2);
    const fileName = core.buildOutputFileName(path.basename(paths[0]), targets[0].id);
    assert.deepEqual(metadataSegments(fs.readFileSync(path.join(output, fileName))), core.extractJpegMetadataSegments(source, targets[0]).map((segment) => Uint8Array.from(segment)));
    console.log("Verified individual upscale JPG; capturing the workspace...");
    await page.screenshot({ path: path.join(screenshots, `histi-upscale-${mode}.png`) });
    await page.locator("#clear-button").click();
    if (mode === "both") await page.locator("#upscale-square").uncheck();
    await page.locator("#file-input").setInputFiles([paths[1]]);
    await page.locator("#process-button").click();
    await page.waitForFunction(() => document.querySelector("#ready-count").textContent === "1"
      && document.querySelector("#process-button").textContent === "Process");
    console.log("Saving a one-output batch directly as JPG...");
    await page.locator("#download-all-button").click();
    await waitForSaves(3);
    assert.ok((await application.evaluate(() => globalThis.upscaleDownloads)).at(-1).name.endsWith(".jpg"), "One upscale output must save as JPG, not ZIP");
    console.log(`PASS: ${mode}: 100 sources, ${100 * targets.length} Lanczos outputs, correct dimensions/names, raw EXIF/XMP/comment preservation, native ZIP/JPG saves and single-output Download All`);
  } finally { await application.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
