window.runHistiPresentationChecks = async function (nativeApp) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const $ = (selector) => document.querySelector(selector);
  const rows = () => [...document.querySelectorAll("#results-body tr")];
  const waitFor = async (condition) => {
    const deadline = Date.now() + 30000;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error("Timed out waiting for image processing");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const select = (files) => {
    const data = new DataTransfer();
    files.forEach((file) => data.items.add(file));
    $("#file-input").files = data.files;
    $("#file-input").dispatchEvent(new Event("change", { bubbles: true }));
  };
  const jpeg = async (width, height, name) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").fillRect(0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg"));
    canvas.width = canvas.height = 0;
    return new File([blob], name, { type: "image/jpeg" });
  };

  check(window.HISTI_CORE.APP_VERSION === "V1.7", "Wrong application version");
  check($(".app-download").hidden === nativeApp, "Wrong download-app visibility");
  check((getComputedStyle($(".app-download")).display === "none") === nativeApp, "Download-app CSS visibility incorrect");
  check($("#output-landscape").checked && $("#output-square").checked, "Defaults changed");
  $("#show-skipped-button").click();
  check(rows().length === 0 && $("#empty-state").textContent === "No skipped files.", "Empty skipped view incorrect");
  $("#show-all-button").click();

  const valid = await jpeg(3840, 2160, "valid_16x9_3840x2160.jpg");
  const wrongSize = await jpeg(100, 100, "wrong-size.jpg");
  const png = new File(["not a jpeg"], "not-jpg.PNG", { type: "image/png" });
  const broken = new File(["invalid JPEG"], "broken.jpg", { type: "image/jpeg" });
  select([valid, png, wrongSize, broken]);
  check(rows().length === 7 && $("#error-count").textContent === "1", "Non-JPG must skip immediately");
  $("#show-skipped-button").click();
  check(rows().length === 1 && rows()[0].textContent.includes("not-jpg.PNG")
    && rows()[0].textContent.includes("Only JPG files are supported."), "Skipped filename/reason missing");
  $("#process-button").click();
  await waitFor(() => $("#process-button").textContent === "Process");
  check($("#ready-count").textContent === "2" && $("#error-count").textContent === "5", "Processing must ignore result filter");
  check(rows().length === 5 && rows().every((row) => row.querySelector('[data-status="error"]')), "New errors must appear in filtered view");
  check(rows().some((row) => row.textContent.includes("wrong-size.jpg"))
    && rows().some((row) => row.textContent.includes("broken.jpg")), "Processing failures absent");
  check($("#empty-state").hidden && $("#preview").hidden, "Filtered view must hide empty state and output preview");
  check(!$("#download-all-button").disabled, "Filtering must not block successful downloads");
  $("#output-square").click();
  check(rows().length === 3 && $("#ready-count").textContent === "1", "Output choices must apply within skipped view");
  $("#show-all-button").click();
  check(rows().length === 4 && !$("#preview").hidden && $("#results-filter").hidden, "Show All must restore results and preview");
  $("#output-square").click();
  $("#show-skipped-button").click();
  select([png]);
  $("#queue-add").click();
  check(rows().length === 6 && $("#show-skipped-button").getAttribute("aria-pressed") === "true", "Add must retain filter and list new skipped file");
  select([valid]);
  $("#queue-replace").click();
  check(rows().length === 2 && $("#results-filter").hidden, "Replace must reset filter");
  $("#show-skipped-button").click();
  $("#clear-button").click();
  check($("#results-filter").hidden && $("#empty-state").textContent === "No files queued.", "Clear must reset filter");
  return "PASS: version, platform header, defaults, skipped filenames/reasons, live failures, output toggles, Add/Replace, Clear and filter-independent processing/downloads";
};
