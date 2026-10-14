const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("HISTI_NATIVE_APP", true);
