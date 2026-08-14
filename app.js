(function () {
  "use strict";

  const core = window.HISTI_CORE;
  const zip = window.HISTI_ZIP;
  const outputUrls = new Map();

  const state = {
    files: [],
    outputs: [],
    processing: false,
  };

  const refs = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function initRefs() {
    refs.version = $("[data-version]");
    refs.dropzone = $("#dropzone");
    refs.fileInput = $("#file-input");
    refs.pickButton = $("#pick-button");
    refs.processButton = $("#process-button");
    refs.downloadAllButton = $("#download-all-button");
    refs.clearButton = $("#clear-button");
    refs.status = $("#status-line");
    refs.tableBody = $("#results-body");
    refs.emptyState = $("#empty-state");
    refs.fileCount = $("#file-count");
    refs.readyCount = $("#ready-count");
    refs.errorCount = $("#error-count");
    refs.preview = $("#preview");
    refs.previewImage = $("#preview-image");
    refs.previewName = $("#preview-name");
  }

  function setStatus(message, kind) {
    refs.status.textContent = message;
    refs.status.dataset.kind = kind || "";
  }

  function setBusy(isBusy) {
    state.processing = isBusy;
    refs.processButton.disabled = isBusy || state.files.length === 0;
    refs.pickButton.disabled = isBusy;
    refs.clearButton.disabled = isBusy && state.outputs.length === 0;
    refs.downloadAllButton.disabled = isBusy || state.outputs.length === 0;
    refs.processButton.textContent = isBusy ? "Processing..." : "Process";
  }

  function resetObjectUrls() {
    outputUrls.forEach((url) => URL.revokeObjectURL(url));
    outputUrls.clear();
  }

  function setFiles(files) {
    resetObjectUrls();
    state.files = [...files].filter((file) => core.isJpegFileName(file.name));
    state.outputs = [];
    refs.fileInput.value = "";
    render();

    if (state.files.length === 0) {
      setStatus("Select one or more JPG files.", "warn");
    } else {
      setStatus(`${state.files.length} JPG file${state.files.length === 1 ? "" : "s"} queued.`, "ready");
    }
  }

  function clearAll() {
    resetObjectUrls();
    state.files = [];
    state.outputs = [];
    refs.fileInput.value = "";
    refs.preview.hidden = true;
    refs.previewImage.removeAttribute("src");
    refs.previewName.textContent = "";
    render();
    setStatus("Select one or more JPG files.", "");
  }

  function outputUrl(output) {
    if (!output.blob) {
      return "";
    }
    if (!outputUrls.has(output.id)) {
      outputUrls.set(output.id, URL.createObjectURL(output.blob));
    }
    return outputUrls.get(output.id);
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file);
      } catch {
        // The fallback keeps Safari/local file behavior simple.
      }
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image."));
      };
      image.src = url;
    });
  }

  function canvasToJpeg(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not write JPG output."));
          }
        },
        "image/jpeg",
        0.98
      );
    });
  }

  async function resizeImage(file) {
    const outputName = core.buildOutputFileName(file.name);
    const image = await loadImage(file);
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    core.validateSourceDimensions(width, height);

    const canvas = document.createElement("canvas");
    canvas.width = core.TARGET_WIDTH;
    canvas.height = core.TARGET_HEIGHT;

    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, core.TARGET_WIDTH, core.TARGET_HEIGHT);

    if (typeof image.close === "function") {
      image.close();
    }

    const blob = await canvasToJpeg(canvas);
    return {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      inputName: file.name,
      outputName,
      inputSize: file.size,
      outputSize: blob.size,
      sourceDimensions: `${width}x${height}`,
      outputDimensions: `${core.TARGET_WIDTH}x${core.TARGET_HEIGHT}`,
      blob,
      status: "Ready",
      error: "",
    };
  }

  async function processFiles() {
    if (state.processing || state.files.length === 0) {
      return;
    }

    resetObjectUrls();
    state.outputs = [];
    render();
    setBusy(true);
    setStatus("Processing JPG files...", "ready");

    for (let index = 0; index < state.files.length; index += 1) {
      const file = state.files[index];
      try {
        const output = await resizeImage(file);
        state.outputs.push(output);
      } catch (error) {
        state.outputs.push({
          id: `${file.name}-${file.lastModified}-${file.size}-${index}`,
          inputName: file.name,
          outputName: "",
          inputSize: file.size,
          outputSize: 0,
          sourceDimensions: "",
          outputDimensions: "",
          blob: null,
          status: "Skipped",
          error: error.message || "Could not process image.",
        });
      }
      render();
    }

    const readyCount = state.outputs.filter((output) => output.blob).length;
    const errorCount = state.outputs.length - readyCount;
    setBusy(false);

    if (readyCount > 0) {
      showPreview(state.outputs.find((output) => output.blob));
    }

    if (errorCount > 0) {
      setStatus(`${readyCount} ready, ${errorCount} skipped.`, "warn");
    } else {
      setStatus(`${readyCount} output file${readyCount === 1 ? "" : "s"} ready.`, "success");
    }
  }

  function showPreview(output) {
    if (!output || !output.blob) {
      refs.preview.hidden = true;
      return;
    }
    refs.preview.hidden = false;
    refs.previewImage.src = outputUrl(output);
    refs.previewName.textContent = output.outputName;
  }

  async function downloadAll() {
    const outputs = state.outputs.filter((output) => output.blob);
    if (outputs.length === 0) {
      return;
    }

    if (outputs.length === 1) {
      downloadBlob(outputs[0].blob, outputs[0].outputName);
      return;
    }

    setBusy(true);
    setStatus("Building ZIP...", "ready");
    try {
      const blob = await zip.createZipBlob(outputs.map((output) => ({
        name: output.outputName,
        blob: output.blob,
      })));
      downloadBlob(blob, "HISTI_V1_2_1920x1080_outputs.zip");
      setStatus(`${outputs.length} output files zipped.`, "success");
    } catch (error) {
      setStatus(error.message || "Could not build ZIP.", "error");
    } finally {
      setBusy(false);
    }
  }

  function renderStats() {
    const readyCount = state.outputs.filter((output) => output.blob).length;
    const errorCount = state.outputs.filter((output) => !output.blob).length;
    refs.fileCount.textContent = String(state.files.length);
    refs.readyCount.textContent = String(readyCount);
    refs.errorCount.textContent = String(errorCount);
  }

  function renderRows() {
    refs.tableBody.innerHTML = "";

    if (state.files.length === 0 && state.outputs.length === 0) {
      refs.emptyState.hidden = false;
      return;
    }

    refs.emptyState.hidden = true;

    const rows = state.outputs.length > 0
      ? state.outputs
      : state.files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        inputName: file.name,
        outputName: "",
        inputSize: file.size,
        outputSize: 0,
        sourceDimensions: "",
        outputDimensions: "",
        blob: null,
        status: "Queued",
        error: "",
      }));

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const action = document.createElement("td");
      const original = document.createElement("td");
      const output = document.createElement("td");
      const status = document.createElement("td");

      action.className = "download-cell";
      original.append(createFileName(row.inputName));
      if (row.inputSize) {
        original.append(createMeta(core.formatBytes(row.inputSize)));
      }
      if (row.outputName) {
        output.append(createFileName(row.outputName));
      }
      if (row.outputDimensions) {
        output.append(createMeta(row.outputDimensions));
      }
      status.textContent = row.error || row.status;
      status.dataset.status = row.blob ? "ready" : row.error ? "error" : "queued";

      if (row.blob) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tiny-button";
        button.textContent = "Download JPG";
        button.addEventListener("click", () => downloadBlob(row.blob, row.outputName));
        action.append(button);
      } else {
        action.append(createMeta(row.status));
      }

      tr.append(action, original, output, status);
      refs.tableBody.append(tr);
    });
  }

  function createFileName(value) {
    const span = document.createElement("span");
    span.className = "file-name";
    span.textContent = value || "";
    return span;
  }

  function createMeta(value) {
    const span = document.createElement("span");
    span.className = "row-meta";
    span.textContent = value || "";
    return span;
  }

  function render() {
    renderStats();
    renderRows();
    refs.processButton.disabled = state.processing || state.files.length === 0;
    refs.downloadAllButton.disabled = state.processing || !state.outputs.some((output) => output.blob);
    refs.clearButton.disabled = state.processing ? state.files.length === 0 && state.outputs.length === 0 : false;
  }

  function bindEvents() {
    refs.version.textContent = core.APP_VERSION;

    refs.pickButton.addEventListener("click", () => refs.fileInput.click());
    refs.fileInput.addEventListener("change", (event) => setFiles(event.target.files || []));
    refs.processButton.addEventListener("click", processFiles);
    refs.downloadAllButton.addEventListener("click", downloadAll);
    refs.clearButton.addEventListener("click", clearAll);

    ["dragenter", "dragover"].forEach((eventName) => {
      refs.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        refs.dropzone.classList.add("dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      refs.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        refs.dropzone.classList.remove("dragging");
      });
    });

    refs.dropzone.addEventListener("drop", (event) => {
      setFiles(event.dataTransfer.files || []);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initRefs();
    bindEvents();
    clearAll();
  });
})();
