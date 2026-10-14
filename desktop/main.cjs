const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const path = require("node:path");
const { isWorkspaceURL, externalURL } = require("./policy.cjs");

let window;
const site = app.isPackaged ? path.join(process.resourcesPath, "site") : path.resolve(__dirname, "..");
const indexPath = path.join(site, "index.html");

function openExternal(url) {
  const allowed = externalURL(url);
  if (allowed) shell.openExternal(allowed).catch((error) => dialog.showErrorBox("HISTI", error.message));
}

async function createWindow() {
  window = new BrowserWindow({
    width: 1240, height: 880, minWidth: 780, minHeight: 600,
    title: "Honey, I Shrunk the Images",
    icon: path.join(site, "assets", "histi_icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
      partition: "histi-workspace"
    }
  });
  const contents = window.webContents;
  contents.on("page-title-updated", (event) => event.preventDefault());
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
  contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: "deny" }; });
  contents.on("will-navigate", (event, url) => {
    if (!isWorkspaceURL(url, indexPath)) { event.preventDefault(); openExternal(url); }
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.session.on("will-download", (event, item, source) => {
    if (source !== contents || !item.getURL().startsWith("blob:")) { event.preventDefault(); return; }
    item.setSaveDialogOptions({
      title: "Save HISTI Output",
      defaultPath: path.join(app.getPath("downloads"), path.basename(item.getFilename())),
      properties: ["showOverwriteConfirmation", "createDirectory"]
    });
    item.once("done", (_event, state) => {
      if (state === "interrupted") dialog.showErrorBox("HISTI", "The output could not be saved. Please try the download again.");
    });
  });
  contents.on("render-process-gone", () => dialog.showErrorBox("HISTI", "The image workspace closed unexpectedly. Reopen HISTI and select the batch again."));
  window.once("ready-to-show", () => window.show());
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "File", submenu: [
      { label: "Select Images...", accelerator: "CmdOrCtrl+O", click: () => contents.executeJavaScript("document.getElementById('pick-button').click()") },
      { type: "separator" }, { role: "quit" }
    ] },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Help", submenu: [{ label: "Documentation", click: () => openExternal("https://michaelbrandonfalk.github.io/HISTI/") }] }
  ]));
  await window.loadFile(indexPath);
}

app.whenReady().then(createWindow).catch((error) => { dialog.showErrorBox("HISTI", error.message); app.quit(); });
app.on("window-all-closed", () => app.quit());
