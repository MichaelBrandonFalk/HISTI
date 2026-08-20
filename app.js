(function () {
  "use strict";

  const core = window.HISTI_CORE;
  const zip = window.HISTI_ZIP;
  const outputUrls = new Map();

  const state = {
    items: [],
    pendingItems: [],
    processing: false,
  };
  let nextItemId = 1;

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
    refs.queueChoice = $("#queue-choice");
    refs.queueSummary = $("#queue-choice-summary");
    refs.queueAdd = $("#queue-add");
    refs.queueReplace = $("#queue-replace");
    refs.queueCancel = $("#queue-cancel");
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
    refs.processButton.disabled = isBusy || !hasQueuedJpegs();
    refs.pickButton.disabled = isBusy;
    refs.clearButton.disabled = isBusy || state.items.length === 0;
    refs.downloadAllButton.disabled = isBusy || readyItems().length === 0;
    refs.processButton.textContent = isBusy ? "Processing..." : "Process";
  }

  function resetObjectUrls() {
    outputUrls.forEach((url) => URL.revokeObjectURL(url));
    outputUrls.clear();
  }

  function selectedFileItems(files) {
    return [...files].flatMap((file) => {
      if (!core.isJpegFileName(file.name)) {
        const item = {
          id: `item-${nextItemId}`,
          file: null,
          targetId: "",
          targetLabel: "",
          inputName: file.name,
          outputName: "",
          inputSize: file.size,
          outputSize: 0,
          sourceDimensions: "",
          outputDimensions: "",
          blob: null,
          status: "Skipped",
          error: "Only JPG files are supported.",
        };
        nextItemId += 1;
        return [item];
      }

      return core.OUTPUT_TARGETS.map((target) => {
        let outputName = "";
        try {
          outputName = core.buildOutputFileName(file.name, target.id);
        } catch {
          outputName = "";
        }

        const item = {
          id: `item-${nextItemId}`,
          file,
          targetId: target.id,
          targetLabel: target.label,
          inputName: file.name,
          outputName,
          inputSize: file.size,
          outputSize: 0,
          sourceDimensions: "",
          outputDimensions: "",
          blob: null,
          status: "Queued",
          error: "",
        };
        nextItemId += 1;
        return item;
      });
    });
  }

  function handleSelectedFiles(files) {
    const items = selectedFileItems(files || []);
    refs.fileInput.value = "";

    if (items.length === 0) {
      setStatus("No files selected.", "warn");
      return;
    }

    if (state.items.length > 0) {
      state.pendingItems = items;
      showQueueChoice(items);
      return;
    }

    applySelectedItems(items, "replace");
  }

  function showQueueChoice(items) {
    refs.queueSummary.textContent = selectionSummary(items);
    refs.queueChoice.hidden = false;
    refs.queueAdd.focus();
  }

  function hideQueueChoice() {
    refs.queueChoice.hidden = true;
    state.pendingItems = [];
  }

  function applySelectedItems(items, mode) {
    if (mode === "replace") {
      resetObjectUrls();
      state.items = items;
      refs.preview.hidden = true;
      refs.previewImage.removeAttribute("src");
      refs.previewName.textContent = "";
    } else {
      state.items = [...state.items, ...items];
    }

    hideQueueChoice();
    render();
    setStatus(selectionSummary(items, mode === "add" ? "Added" : "Queued"), statusKindForItems(items));
  }

  function selectionSummary(items, verb = "Selected") {
    const outputs = items.filter((item) => item.file).length;
    const skipped = items.length - outputs;
    const noun = outputs === 1 ? "output" : "outputs";
    if (skipped > 0) {
      return `${verb} ${outputs} ${noun}; ${skipped} skipped.`;
    }
    return `${verb} ${outputs} ${noun}.`;
  }

  function statusKindForItems(items) {
    return items.some((item) => item.error) ? "warn" : "ready";
  }

  function clearAll() {
    resetObjectUrls();
    state.items = [];
    state.pendingItems = [];
    refs.fileInput.value = "";
    refs.queueChoice.hidden = true;
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

  async function resizeImage(item) {
    const file = item.file;
    const target = core.getOutputTarget(item.targetId);
    const outputName = core.buildOutputFileName(item.inputName, target.id);
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const image = await loadImage(file);
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    core.validateSourceDimensions(width, height);

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawTargetImage(context, image, width, height, target);

    if (typeof image.close === "function") {
      image.close();
    }

    const rawBlob = await canvasToJpeg(canvas);
    const rawBytes = new Uint8Array(await rawBlob.arrayBuffer());
    const mergedBytes = core.mergeJpegMetadata(rawBytes, sourceBytes, target);
    const blob = new Blob([mergedBytes], { type: "image/jpeg" });

    return {
      id: item.id,
      inputName: item.inputName,
      outputName,
      inputSize: item.inputSize,
      outputSize: blob.size,
      sourceDimensions: `${width}x${height}`,
      outputDimensions: `${target.width}x${target.height}`,
      blob,
      status: "Ready",
      error: "",
    };
  }

  function drawTargetImage(context, image, width, height, target) {
    if (target.mode === "cover") {
      const scale = Math.max(target.width / width, target.height / height);
      const drawWidth = width * scale;
      const drawHeight = height * scale;
      const dx = (target.width - drawWidth) / 2;
      const dy = (target.height - drawHeight) / 2;
      context.drawImage(image, dx, dy, drawWidth, drawHeight);
      return;
    }

    context.drawImage(image, 0, 0, target.width, target.height);
  }

  async function processFiles() {
    if (state.processing || !hasQueuedJpegs()) {
      return;
    }

    render();
    setBusy(true);
    setStatus("Processing JPG files...", "ready");

    for (const item of state.items) {
      if (!item.file || item.blob || item.error) {
        continue;
      }

      try {
        Object.assign(item, await resizeImage(item));
      } catch (error) {
        Object.assign(item, {
          outputName: "",
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

    const readyCount = readyItems().length;
    const errorCount = state.items.filter((item) => item.error).length;
    setBusy(false);

    if (readyCount > 0) {
      showPreview(readyItems().at(-1));
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
    const outputs = readyItems();
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
      downloadBlob(blob, "HISTI_V1_4_outputs.zip");
      setStatus(`${outputs.length} output files zipped.`, "success");
    } catch (error) {
      setStatus(error.message || "Could not build ZIP.", "error");
    } finally {
      setBusy(false);
    }
  }

  function renderStats() {
    const readyCount = readyItems().length;
    const errorCount = state.items.filter((item) => item.error).length;
    refs.fileCount.textContent = String(state.items.length);
    refs.readyCount.textContent = String(readyCount);
    refs.errorCount.textContent = String(errorCount);
  }

  function renderRows() {
    refs.tableBody.innerHTML = "";

    if (state.items.length === 0) {
      refs.emptyState.hidden = false;
      return;
    }

    refs.emptyState.hidden = true;

    const rows = state.items;

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
      if (row.targetLabel) {
        output.append(createMeta(row.targetLabel));
      } else if (row.outputDimensions) {
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
    refs.processButton.disabled = state.processing || !hasQueuedJpegs();
    refs.downloadAllButton.disabled = state.processing || readyItems().length === 0;
    refs.clearButton.disabled = state.processing || state.items.length === 0;
  }

  function readyItems() {
    return state.items.filter((item) => item.blob);
  }

  function hasQueuedJpegs() {
    return state.items.some((item) => item.file && !item.blob && !item.error);
  }

  function bindEvents() {
    refs.version.textContent = core.APP_VERSION;

    refs.pickButton.addEventListener("click", () => refs.fileInput.click());
    refs.fileInput.addEventListener("change", (event) => handleSelectedFiles(event.target.files || []));
    refs.processButton.addEventListener("click", processFiles);
    refs.downloadAllButton.addEventListener("click", downloadAll);
    refs.clearButton.addEventListener("click", clearAll);
    refs.queueAdd.addEventListener("click", () => applySelectedItems(state.pendingItems, "add"));
    refs.queueReplace.addEventListener("click", () => applySelectedItems(state.pendingItems, "replace"));
    refs.queueCancel.addEventListener("click", hideQueueChoice);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !refs.queueChoice.hidden) {
        hideQueueChoice();
      }
    });

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
      handleSelectedFiles(event.dataTransfer.files || []);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initRefs();
    bindEvents();
    clearAll();
  });
})();
