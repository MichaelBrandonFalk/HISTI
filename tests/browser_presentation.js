async (page) => {
  await page.goto("http://127.0.0.1:8877/");
  await page.addScriptTag({ url: "/tests/presentation_checks.js" });
  const result = await page.evaluate(() => window.runHistiPresentationChecks(false));
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3840;
    canvas.height = 2160;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg"));
    const data = new DataTransfer();
    data.items.add(new File([blob], "download_16x9_3840x2160.jpg", { type: "image/jpeg" }));
    const input = document.querySelector("#file-input");
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#process-button").click();
  });
  await page.waitForFunction(() => document.querySelector("#ready-count").textContent === "2"
    && document.querySelector("#process-button").textContent === "Process");
  await page.locator("#show-skipped-button").click();
  const pending = page.waitForEvent("download");
  await page.locator("#download-all-button").click();
  const download = await pending;
  if (download.suggestedFilename() !== "HISTI_V1_7_outputs.zip") throw new Error("Wrong download version");
  await download.saveAs("/tmp/histi-v17-filtered.zip");
  if (await download.failure()) throw new Error("Filtered-view download failed");
  return result + "; saved both ready outputs while Skipped view was active";
}
