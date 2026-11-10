window.runHistiUpscaleChecks = async function () {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const $ = (selector) => document.querySelector(selector);
  const waitFor = async (condition) => {
    const deadline = Date.now() + 90000;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error("Upscale test timed out: " + $("#status-line").textContent);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  };
  const select = (files) => {
    const data = new DataTransfer();
    files.forEach((file) => data.items.add(file));
    $("#file-input").files = data.files;
    $("#file-input").dispatchEvent(new Event("change", { bubbles: true }));
  };
  $("#clear-button").click();
  check($("#direction-shrink").checked, "Shrink must be the initial direction");
  for (const selector of ["#output-landscape", "#output-square"]) if ($(selector).checked) $(selector).click();
  $("#direction-upscale").click();
  check($("#display-name").textContent === "Honey, I blew up the images", "Upscale feature name missing");
  check($("#shrink-outputs").hidden && !$("#upscale-output").hidden, "Upscale output controls missing");
  check($("#upscale-landscape").checked && $("#upscale-square").checked, "Both upscale outputs must be enabled by default");
  check($("#shrink-rules").hidden && !$("#upscale-rules").hidden, "Wrong direction rule");

  const input = document.createElement("canvas");
  input.width = 1920; input.height = 1080;
  const context = input.getContext("2d");
  const pixels = context.createImageData(input.width, input.height);
  for (let y = 0; y < input.height; y += 1) for (let x = 0; x < input.width; x += 1) {
    const index = (y * input.width + x) * 4;
    for (let c = 0; c < 3; c += 1) pixels.data[index + c] = 64 + ((x * 17 + y * 13 + c * 43) % 128);
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise((resolve) => input.toBlob(resolve, "image/jpeg", 0.98));
  input.width = input.height = 0;
  const wrong = document.createElement("canvas");
  wrong.width = 3840; wrong.height = 2160;
  const wrongBlob = await new Promise((resolve) => wrong.toBlob(resolve, "image/jpeg"));
  wrong.width = wrong.height = 0;
  const files = [new File([blob], "example_16x9_1920x1080.jpg", { type: "image/jpeg" }),
    new File([blob], "plain name.JPEG", { type: "image/jpeg" }),
    new File([wrongBlob], "wrong-direction.jpg", { type: "image/jpeg" }),
    new File(["invalid"], "broken.jpg", { type: "image/jpeg" }),
    new File(["png"], "skipped.png", { type: "image/png" })];

  const originalUpscale = window.HISTI_RESAMPLE.upscale;
  let samples = 0, maxError = 0, resizes = 0;
  const kernel = (distance) => {
    const x = Math.abs(distance);
    if (x < 1e-10) return 1;
    if (x >= 3) return 0;
    return Math.sin(Math.PI * x) / (Math.PI * x) * Math.sin(Math.PI * x / 3) / (Math.PI * x / 3);
  };
  window.HISTI_RESAMPLE.upscale = async (image, canvas) => {
    await originalUpscale(image, canvas);
    resizes += 1;
    const source = document.createElement("canvas");
    source.width = 1920; source.height = 1080;
    source.getContext("2d").drawImage(image, 0, 0);
    const before = source.getContext("2d").getImageData(0, 0, 1920, 1080).data;
    const square = canvas.width === 3000;
    const after = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const xs = square ? [0, 1, 2, 880, 881, 882, 1499, 1500, 1904, 1905, 2998, 2999]
      : [0, 1, 2, 1023, 1024, 1025, 1919, 1920, 2047, 2048, 3837, 3838, 3839];
    const ys = square ? [0, 1, 2, 1023, 1024, 1499, 1500, 2047, 2048, 2997, 2998, 2999]
      : [0, 1, 2, 511, 512, 1023, 1024, 1079, 1080, 2157, 2158, 2159];
    for (const y of ys) {
      for (const x of xs) {
        const cx = (x + (square ? 1167 : 0) + 0.5) * 1920 / (square ? 5334 : 3840) - 0.5;
        const cy = (y + 0.5) * 1080 / (square ? 3000 : 2160) - 0.5;
        for (let channel = 0; channel < 3; channel += 1) {
          let sum = 0, weights = 0;
          for (let sy = Math.max(0, Math.ceil(cy - 3)); sy <= Math.min(1079, Math.floor(cy + 3)); sy += 1) {
            for (let sx = Math.max(0, Math.ceil(cx - 3)); sx <= Math.min(1919, Math.floor(cx + 3)); sx += 1) {
              const weight = kernel(cx - sx) * kernel(cy - sy);
              sum += before[(sy * 1920 + sx) * 4 + channel] * weight;
              weights += weight;
            }
          }
          const expected = Math.max(0, Math.min(255, Math.round(sum / weights)));
          maxError = Math.max(maxError, Math.abs(after[(y * canvas.width + x) * 4 + channel] - expected));
          samples += 1;
        }
        check(after[(y * canvas.width + x) * 4 + 3] === 255, "Non-opaque output pixel");
      }
    }
    source.width = source.height = 0;
  };
  try {
    select(files);
    check($("#results-body").rows.length === 9 && $("#error-count").textContent === "1", "Upscale must create both output rows and skip PNG immediately");
    check($("#direction-shrink").disabled && $("#direction-upscale").disabled, "Queued files must lock the direction");
    $("#direction-shrink").dispatchEvent(new Event("change", { bubbles: true }));
    check($("#direction-upscale").checked, "Direction guard must reject mixed queues");
    $("#process-button").click();
    await waitFor(() => $("#process-button").textContent === "Process");
    check($("#ready-count").textContent === "4" && $("#error-count").textContent === "5", "Wrong upscale results: " + $("#status-line").textContent);
    check(resizes === 4, "Invalid files must not enter the Lanczos resampler");
    check(samples === 1800 && maxError <= 3, `Independent full-size Lanczos/crop reference mismatch: ${maxError} over ${samples} comparisons`);
    const names = $("#results-body").textContent;
    check(names.includes("example_16x9_3840x2160.jpg") && names.includes("plain name_16x9_3840x2160.JPEG"), "Upscale output naming incorrect");
    check(names.includes("example_1x1_3000x3000.jpg") && names.includes("plain name_1x1_3000x3000.JPEG"), "Square upscale naming incorrect");
    check(names.includes("Switch Direction to Shrink"), "Wrong-direction skip must explain how to proceed");
    $("#show-skipped-button").click();
    check($("#results-body").rows.length === 5, "Skipped filter must work in Upscale");
    check(!$("#download-all-button").disabled, "Skipped filter must not block ready downloads");
    $("#upscale-square").click();
    check($("#ready-count").textContent === "2", "Square disable must exclude cached outputs");
    $("#upscale-landscape").click();
    check($("#ready-count").textContent === "0" && $("#download-all-button").disabled && $("#process-button").disabled, "Both-off upscale must block processing and downloads");
    $("#upscale-square").click();
    check($("#ready-count").textContent === "2" && resizes === 4, "Re-enabling square must reuse cached results");
    $("#upscale-landscape").click();
    check($("#ready-count").textContent === "4" && resizes === 4, "Re-enabling landscape must reuse cached results");
    $("#clear-button").click();
    $("#upscale-square").click();
    select([files[0]]);
    $("#process-button").click();
    await waitFor(() => $("#process-button").textContent === "Process");
    check($("#ready-count").textContent === "1" && resizes === 5, "Landscape-only upscale must skip square encoding");
    $("#upscale-square").click();
    check(!$("#process-button").disabled, "Enabling an unprocessed output must queue it");
    $("#process-button").click();
    await waitFor(() => $("#process-button").textContent === "Process");
    check($("#ready-count").textContent === "2" && resizes === 6 && maxError <= 3, "Pending square output must encode once without re-encoding landscape");
    $("#clear-button").click();
    check(!$("#direction-shrink").disabled && $("#direction-upscale").checked, "Clear must unlock direction without changing it");
    $("#direction-shrink").click();
    check($("#display-name").textContent === "Honey, I Shrunk the Images", "Original feature name not restored");
    check($("#upscale-output").hidden && !$("#shrink-outputs").hidden, "Original outputs not restored");
    check($("#process-button").disabled, "Both-off Shrink preference must be retained");
    for (const selector of ["#output-landscape", "#output-square"]) if (!$(selector).checked) $(selector).click();
    return `PASS: dual upscale defaults, independent choices, both-off guard, cached results, direction lock, unchanged Shrink preferences, filenames and ${samples} independent Lanczos3/crop pixel comparisons (max error ${maxError})`;
  } finally { window.HISTI_RESAMPLE.upscale = originalUpscale; }
};
