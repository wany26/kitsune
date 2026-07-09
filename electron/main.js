// Electron main process.
//
// The GUI is only a *manager*: it drives the existing core library
// (src/index.js) over IPC and tracks which profiles have a live browser.
// Launching a profile still opens a real Playwright-controlled Chromium window
// with the fingerprint + proxy applied — this window is just the control panel.

import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  launchProfile,
  generateFingerprint,
  PRESETS,
  SUPPORTED_PROXY_TYPES,
  listEngines,
  browserStatus,
  installBrowser,
  protocolStatus,
  installProtocol,
  checkProxy,
  WEBGL_OPTIONS,
  paths,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** profileId -> { dispose } for every profile with a live browser. */
const sessions = new Map();
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    title: "Kitsune",
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "ui", "index.html"));

  win.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error(`renderer failed to load: ${code} ${desc}`);
    if (process.env.FPB_SMOKE) app.exit(1);
  });
  if (process.env.FPB_SMOKE) {
    // Surface any renderer error and give init()'s async IPC time to complete
    // before quitting, so the smoke test actually exercises the UI wiring.
    win.webContents.on("console-message", (_e, level, message) => {
      if (level >= 2) console.error(`renderer console: ${message}`);
    });
    win.webContents.on("did-finish-load", () => {
      setTimeout(() => {
        console.log("FPB_SMOKE: renderer loaded OK");
        app.quit();
      }, 1500);
    });
  }
}

// ---- IPC: profile CRUD (pure library pass-through) -----------------------
ipcMain.handle("profiles:list", () => withStatus(listProfiles()));
ipcMain.handle("profiles:create", (_e, opts) => {
  const p = createProfile(opts);
  return withStatus([p])[0];
});
ipcMain.handle("profiles:update", (_e, { id, patch }) => updateProfile(id, patch));
ipcMain.handle("profiles:delete", (_e, id) => {
  const s = sessions.get(id);
  if (s) s.dispose();
  sessions.delete(id);
  return deleteProfile(id);
});
ipcMain.handle("profiles:fingerprint", (_e, id) => {
  const p = getProfile(id);
  if (!p) throw new Error(`profile not found: ${id}`);
  return generateFingerprint({
    seed: p.seed, engine: p.engine, os: p.os, presetId: p.presetId || undefined,
    uaOverride: p.uaOverride || undefined, config: p.config, overrides: p.overrides,
  });
});

ipcMain.handle("meta:presets", () => PRESETS.map((p) => ({ id: p.id, os: p.os, gpu: p.webglVendor })));
ipcMain.handle("meta:proxyTypes", () => SUPPORTED_PROXY_TYPES);
ipcMain.handle("meta:engines", () => listEngines());
ipcMain.handle("meta:webgl", () => WEBGL_OPTIONS);
ipcMain.handle("meta:paths", () => paths);
ipcMain.handle("meta:openDataDir", () => shell.openPath(paths.HOME));
ipcMain.handle("proxy:check", (_e, { spec, provider }) => checkProxy(spec, provider));

// ---- IPC: kernel management ----------------------------------------------
ipcMain.handle("kernels:status", async () => ({ browsers: await browserStatus(), protocols: await protocolStatus() }));
ipcMain.handle("kernels:installBrowser", (_e, engine) =>
  installBrowser(engine, (line) => win && !win.isDestroyed() && win.webContents.send("kernels:log", line))
);
ipcMain.handle("kernels:installProtocol", (_e, name) =>
  installProtocol(name, (line) => win && !win.isDestroyed() && win.webContents.send("kernels:log", line))
);

// ---- IPC: browser session lifecycle --------------------------------------
ipcMain.handle("session:launch", async (_e, { id, url }) => {
  const profile = getProfile(id);
  if (!profile) throw new Error(`profile not found: ${id}`);
  if (sessions.has(id)) return { running: true };

  const { context, fingerprint, dispose } = await launchProfile(profile, { url, headless: false });
  sessions.set(id, { dispose });

  // If the user closes the browser window directly, reflect it in the UI.
  context.on("close", () => {
    sessions.delete(id);
    if (win && !win.isDestroyed()) win.webContents.send("session:closed", id);
  });

  return { running: true, fingerprint };
});

ipcMain.handle("session:stop", async (_e, id) => {
  const s = sessions.get(id);
  if (s) await s.dispose();
  sessions.delete(id);
  return { running: false };
});

ipcMain.handle("session:running", () => [...sessions.keys()]);

/** Annotate profiles with their live-session status for the UI. */
function withStatus(profiles) {
  return profiles.map((p) => ({ ...p, running: sessions.has(p.id) }));
}

// ---- app lifecycle -------------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  for (const s of sessions.values()) {
    try {
      s.dispose();
    } catch (e) {}
  }
  sessions.clear();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
