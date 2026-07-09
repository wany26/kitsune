// Preload: the only bridge between the sandboxed renderer and the main process.
// Exposes a minimal, explicit `window.fpb` API — no direct Node/IPC access leaks
// into page context (contextIsolation on, nodeIntegration off).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fpb", {
  // profiles
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  createProfile: (opts) => ipcRenderer.invoke("profiles:create", opts),
  updateProfile: (id, patch) => ipcRenderer.invoke("profiles:update", { id, patch }),
  deleteProfile: (id) => ipcRenderer.invoke("profiles:delete", id),
  fingerprint: (id) => ipcRenderer.invoke("profiles:fingerprint", id),

  // metadata
  presets: () => ipcRenderer.invoke("meta:presets"),
  proxyTypes: () => ipcRenderer.invoke("meta:proxyTypes"),
  engines: () => ipcRenderer.invoke("meta:engines"),
  webglOptions: () => ipcRenderer.invoke("meta:webgl"),
  paths: () => ipcRenderer.invoke("meta:paths"),
  openDataDir: () => ipcRenderer.invoke("meta:openDataDir"),

  // proxy
  checkProxy: (spec, provider) => ipcRenderer.invoke("proxy:check", { spec, provider }),

  // kernels
  kernels: () => ipcRenderer.invoke("kernels:status"),
  installBrowser: (engine) => ipcRenderer.invoke("kernels:installBrowser", engine),
  installProtocol: (name) => ipcRenderer.invoke("kernels:installProtocol", name),
  onKernelLog: (cb) => ipcRenderer.on("kernels:log", (_e, line) => cb(line)),

  // sessions
  launch: (id, url) => ipcRenderer.invoke("session:launch", { id, url }),
  stop: (id) => ipcRenderer.invoke("session:stop", id),
  running: () => ipcRenderer.invoke("session:running"),
  onSessionClosed: (cb) => ipcRenderer.on("session:closed", (_e, id) => cb(id)),
});
