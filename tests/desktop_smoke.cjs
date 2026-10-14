const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { _electron } = require("playwright");
const core = require("../histi_core.js");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "output", "desktop", process.platform);
const fixtures = path.join(output, "fixtures");
fs.mkdirSync(fixtures, { recursive: true });

async function main() {
  const executable = process.argv[2];
  const application = await _electron.launch({
    executablePath: executable || require("electron"),
    args: executable ? [] : [root],
    timeout: 60000,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" }
  });
  try {
    const page = await application.firstWindow({ timeout: 60000 });
    await page.waitForFunction(() => window.HISTI_CORE?.APP_VERSION === "V1.8");
    const security = await application.evaluate(({ BrowserWindow }) => {
      const options = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: options.sandbox, contextIsolation: options.contextIsolation, nodeIntegration: options.nodeIntegration };
    });
    assert.deepEqual(security, { sandbox: true, contextIsolation: true, nodeIntegration: false });
    assert.equal(await page.evaluate(() => typeof window.require), "undefined");
    assert.ok(await page.locator(".download-links").isHidden());
    assert.equal(await page.locator(".app-download:visible").count(), 0);
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "presentation_checks.js"), "utf8") });
    console.log(await page.evaluate(() => window.runHistiPresentationChecks(true)));

    const encoded = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 3840; canvas.height = 2160;
      const context = canvas.getContext("2d");
      for (let y = 0; y < 2160; y += 48) for (let x = 0; x < 3840; x += 48) {
        context.fillStyle = `rgb(${(x * 7 + y) % 256},${(y * 3 + x) % 256},${(x + y * 5) % 256})`;
        context.fillRect(x, y, 48, 48);
      }
      return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
    });
    const jpeg = Buffer.from(encoded, "base64");
    const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" tiff:ImageWidth="3840" tiff:ImageLength="2160" dc:description="HISTI metadata preservation test"/></rdf:RDF></x:xmpmeta>');
    const header = Buffer.alloc(4);
    header[0] = 0xff; header[1] = 0xe1; header.writeUInt16BE(xmp.length + 2, 2);
    const source = Buffer.concat([jpeg.subarray(0, 2), header, xmp, jpeg.subarray(2)]);
    const paths = [];
    for (let i = 0; i < 100; i += 1) {
      const name = `batch_${String(i).padStart(3, "0")}_16x9_3840x2160.jpg`;
      const target = path.join(fixtures, name);
      fs.writeFileSync(target, source); paths.push(target);
    }
    const png = path.join(fixtures, "skipped.png");
    fs.writeFileSync(png, "not a JPG"); paths.push(png);
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#pick-button").click();
    await (await chooser).setFiles(paths);
    assert.equal(await page.locator("#file-count").textContent(), "101");
    assert.equal(await page.locator("#error-count").textContent(), "1");
    assert.equal(await page.locator("#results-body tr").count(), 201);
    console.log("Selected 100 JPGs plus one skipped PNG; processing both output sizes...");
    await page.locator("#show-skipped-button").click();
    assert.equal(await page.locator("#results-body tr").count(), 1);
    assert.ok((await page.locator("#results-body").textContent()).includes("skipped.png"));
    await page.locator("#process-button").click();
    assert.ok(await page.locator("#output-square").isDisabled());
    await page.waitForFunction(() => document.querySelector("#ready-count").textContent === "200"
      && document.querySelector("#process-button").textContent === "Process", null, { timeout: 600000 });
    console.log("All 200 outputs ready; checking native ZIP and JPG saves...");

    await application.evaluate(({ BrowserWindow }, directory) => {
      globalThis.histiTestDownloads = [];
      BrowserWindow.getAllWindows()[0].webContents.session.on("will-download", (_event, item) => {
        const options = item.getSaveDialogOptions();
        item.setSavePath(directory + "/" + item.getFilename());
        item.once("done", (_event, state) => globalThis.histiTestDownloads.push({
          name: item.getFilename(), state, title: options.title
        }));
      });
    }, output);
    await page.locator("#download-all-button").click();
    const zipPath = path.join(output, "HISTI_V1_8_outputs.zip");
    for (let i = 0; ; i += 1) {
      const saved = await application.evaluate(() => globalThis.histiTestDownloads);
      if (saved.some((file) => file.name.endsWith(".zip") && file.state === "completed")) break;
      assert.ok(i < 600, "Timed out saving ZIP");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    execFileSync(process.execPath, [path.join(__dirname, "verify_batch_zip.js"), zipPath, fixtures, "both"], { stdio: "inherit" });
    await page.locator("#show-all-button").click();
    await page.locator("#results-body button").first().click();
    for (let i = 0; ; i += 1) {
      const saved = await application.evaluate(() => globalThis.histiTestDownloads);
      if (saved.length === 2) {
        assert.ok(saved.every((file) => file.state === "completed" && file.title === "Save HISTI Output"));
        break;
      }
      assert.ok(i < 100, "Timed out saving individual JPG");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const single = path.join(output, core.buildOutputFileName(path.basename(paths[0]), "16x9"));
    assert.ok(fs.statSync(single).size > 1000);
    assert.deepEqual(core.extractJpegMetadataSegments(fs.readFileSync(single), core.getOutputTarget("16x9")), core.extractJpegMetadataSegments(source, core.getOutputTarget("16x9")));
    await page.locator("#output-square").uncheck();
    assert.equal(await page.locator("#ready-count").textContent(), "100");
    await page.locator("#output-landscape").uncheck();
    assert.ok(await page.locator("#download-all-button").isDisabled());
    await page.locator("#output-square").check();
    assert.equal(await page.locator("#ready-count").textContent(), "100");
    await page.locator("#output-landscape").check();
    await page.screenshot({ path: path.join(output, "histi-desktop.png") });
    await page.locator("#show-skipped-button").click();
    await page.screenshot({ path: path.join(output, "histi-skipped.png") });
    console.log("PASS: installed desktop app, sandbox, native marker, file selection, 100 JPGs / 200 outputs, skipped filenames, output choices, native JPG/ZIP downloads and metadata");
  } finally { await application.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
