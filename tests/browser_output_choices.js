async (page) => {
  const landscape = page.getByRole("checkbox", { name: "1920x1080 (16x9)", exact: true });
  const square = page.getByRole("checkbox", { name: "3000x3000 (1x1)", exact: true });
  const process = page.getByRole("button", { name: "Process", exact: true });
  const downloadAll = page.getByRole("button", { name: "Download All Outputs", exact: true });
  const files = ["/tmp/histi-v16-fixtures/ActionBible_051.jpg", "/tmp/histi-v16-fixtures/batch_001_16x9_3840x2160.jpg"];
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const rows = () => page.locator("#results-body tr").count();
  const ready = async (count) => {
    await page.waitForFunction((expected) => document.querySelector("#ready-count").textContent === String(expected)
      && document.querySelector("#process-button").textContent === "Process", count);
  };
  const runProcess = async () => {
    const locked = await page.evaluate(() => {
      document.querySelector("#process-button").click();
      return [...document.querySelectorAll("[data-output-target]")].every((input) => input.disabled);
    });
    check(locked, "Output options must lock during processing");
  };
  const saveZip = async (mode) => {
    const pending = page.waitForEvent("download");
    await downloadAll.click();
    const download = await pending;
    check(download.suggestedFilename() === "HISTI_V1_6_outputs.zip", "Wrong ZIP version");
    await download.saveAs(`/tmp/histi-v16-toggle-${mode}.zip`);
    check(await download.failure() === null, "ZIP download failed");
  };

  check(await landscape.isChecked() && await square.isChecked(), "Both outputs must be enabled by default");
  await page.evaluate(() => {
    window.histiTestEncodes = [];
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.histiTestEncodes.push([this.width, this.height]);
      return original.apply(this, args);
    };
  });
  await page.locator("#file-input").setInputFiles(files);
  check(await rows() === 4, "Default queue must contain both outputs");
  await square.uncheck();
  check(await rows() === 2, "Disabling square must update an existing queue");
  await landscape.uncheck();
  check(await rows() === 0 && await process.isDisabled() && await downloadAll.isDisabled(), "Neither output selected must block processing and downloads");
  check(await page.locator("#file-count").textContent() === "2", "Toggles must retain source images");
  await landscape.check();
  await runProcess();
  await ready(2);
  check(await page.evaluate(() => window.histiTestEncodes.length === 2
    && window.histiTestEncodes.every(([w, h]) => w === 1920 && h === 1080)), "Disabled square outputs must not be rendered");
  await saveZip("landscape");

  await landscape.uncheck();
  await square.check();
  check(await page.locator("#ready-count").textContent() === "0", "Disabled completed outputs must not count as ready");
  await runProcess();
  await ready(2);
  check(await page.evaluate(() => window.histiTestEncodes.length === 4
    && window.histiTestEncodes.slice(2).every(([w, h]) => w === 3000 && h === 3000)), "Square-only processing must render only square outputs");
  await saveZip("square");

  await landscape.check();
  check(await rows() === 4 && await process.isDisabled(), "Re-enabling completed outputs must reuse results");
  await ready(4);
  await saveZip("both");
  await landscape.uncheck();
  await square.uncheck();
  check(await downloadAll.isDisabled() && await page.locator("#preview").isHidden(), "Disabled outputs must be excluded from downloads and preview");
  await landscape.check();
  await square.check();
  check(await page.evaluate(() => window.histiTestEncodes.length === 4), "Toggling completed outputs must not re-encode images");

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await landscape.uncheck();
  await page.locator("#file-input").setInputFiles(files);
  check(await rows() === 2, "Choices must apply before file selection");
  await page.locator("#file-input").setInputFiles(files);
  await page.getByRole("button", { name: "Add to Queue", exact: true }).click();
  check(await rows() === 4, "Add to Queue must honor output choices");
  await page.locator("#file-input").setInputFiles(files);
  await page.getByRole("button", { name: "Replace Queue", exact: true }).click();
  check(await rows() === 2, "Replace Queue must honor output choices");
  await page.reload();
  check(await landscape.isChecked() && await square.isChecked(), "Fresh app must default to both outputs");
  return "PASS: defaults, existing queues, both-off guard, actual single-target encoding, cached outputs, ZIP downloads, Add/Replace and fresh defaults";
}
