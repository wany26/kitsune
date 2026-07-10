// Kernel manager: auto-pull browser engines and proxy-protocol binaries.
//
//  * Browser kernels  -> delegated to Playwright's own downloader
//    (`playwright install <engine>`), which fetches a pinned, verified build.
//  * Protocol kernels -> downloaded from the projects' official GitHub releases
//    into ~/.kitsune/bin. The proxy bridges prefer these managed
//    binaries, falling back to whatever is on PATH.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { chromium, firefox, webkit } from "playwright";
import { getEngine, ENGINES } from "../browser/engines.js";
import { paths } from "../profile/store.js";

const BIN = path.join(paths.HOME, "bin");
const PW_TYPES = { chromium, firefox, webkit };

function ensureBin() {
  fs.mkdirSync(BIN, { recursive: true });
  return BIN;
}

/** Managed binary path if present, else the bare name (so PATH lookup works). */
export function resolveBinary(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const managed = path.join(BIN, exe);
  return fs.existsSync(managed) ? managed : name;
}

function onPath(cmd) {
  const finder = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    execFile(finder, [cmd], (err, stdout) => resolve(!err && stdout.trim() ? stdout.trim().split("\n")[0] : null));
  });
}

// Well-known install locations for the channel browsers, per OS. Absolute
// paths are checked directly; bare names are resolved through PATH.
const SYSTEM_BROWSERS = {
  chrome: {
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["google-chrome", "google-chrome-stable", "chrome"],
    win32: [
      `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
  },
  edge: {
    darwin: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    linux: ["microsoft-edge", "microsoft-edge-stable"],
    win32: [
      `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
  },
};

/** Locate a system browser install by engine id (chrome/edge), or null. */
async function detectSystemBrowser(id) {
  const candidates = (SYSTEM_BROWSERS[id] || {})[process.platform] || [];
  for (const c of candidates) {
    if (path.isAbsolute(c)) {
      if (fs.existsSync(c)) return c;
    } else {
      const p = await onPath(c);
      if (p) return p;
    }
  }
  return null;
}

/** Best-effort version string from `<bin> <args>` (checks stdout and stderr). */
function getVersion(bin, args, re) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 4000, windowsHide: true }, (_err, stdout, stderr) => {
      const text = `${stdout || ""}${stderr || ""}`.trim();
      if (!text) return resolve(null);
      const m = re ? text.match(re) : null;
      resolve(m ? (m[1] || m[0]).trim() : text.split("\n")[0].trim());
    });
  });
}

// ---- browser kernels -----------------------------------------------------

/**
 * Detect every supported browser kernel:
 *   - managed engines (chromium/firefox/webkit) -> the Playwright build
 *   - channel engines  (chrome/edge)            -> the system install
 * Returns per engine: { family, kind, installed, path, source, version }.
 */
export async function browserStatus() {
  const out = {};
  for (const [id, eng] of Object.entries(ENGINES)) {
    if (eng.channel) {
      const p = await detectSystemBrowser(id);
      out[id] = {
        family: eng.family,
        kind: "channel",
        installed: !!p,
        path: p,
        source: p ? "system" : null,
        version: p ? await getVersion(p, ["--version"], /(\d+\.[\d.]+)/) : null,
      };
    } else {
      let execPath = null;
      try {
        execPath = PW_TYPES[eng.pwType].executablePath();
      } catch (e) {}
      const installed = !!(execPath && fs.existsSync(execPath));
      out[id] = {
        family: eng.family,
        kind: "managed",
        installed,
        path: installed ? execPath : null,
        source: installed ? "playwright" : null,
        version: null,
      };
    }
  }
  return out;
}

/** Download a browser engine via Playwright. Streams progress to onLog. */
export function installBrowser(engine, onLog = () => {}) {
  const eng = getEngine(engine);
  const target = eng.channel || eng.browser; // chrome/msedge or chromium/firefox/webkit
  return runStream("npx", ["playwright", "install", target], onLog, "browser install");
}

// ---- protocol kernels ----------------------------------------------------

const PROTOCOLS = {
  xray: {
    repo: "XTLS/Xray-core",
    bins: ["xray"],
    detectBins: ["xray", "v2ray"], // v2ray-core is a drop-in alternative
    versionArgs: ["version"],
    versionRe: /(?:Xray|V2Ray)\s+v?(\d[\w.]*)/i,
    installable: true,
    // process.platform:process.arch -> substring in the release asset name
    match: {
      "darwin:arm64": "macos-arm64",
      "darwin:x64": "macos-64",
      "linux:x64": "linux-64",
      "linux:arm64": "linux-arm64",
      "win32:x64": "windows-64",
    },
  },
  shadowsocks: {
    repo: "shadowsocks/shadowsocks-rust",
    bins: ["sslocal"],
    detectBins: ["sslocal", "ss-local"], // rust `sslocal` or libev `ss-local`
    versionArgs: ["--version"],
    versionRe: /(\d+\.\d[\w.]*)/,
    installable: true,
    match: {
      "darwin:arm64": "aarch64-apple-darwin",
      "darwin:x64": "x86_64-apple-darwin",
      "linux:x64": "x86_64-unknown-linux-gnu",
      "linux:arm64": "aarch64-unknown-linux-gnu",
      "win32:x64": "x86_64-pc-windows-msvc",
    },
  },
  // ssh tunnels use the system client — detect-only, never auto-installed.
  ssh: {
    bins: ["ssh"],
    detectBins: ["ssh"],
    versionArgs: ["-V"],
    versionRe: /OpenSSH[_\w.]+/i,
    installable: false,
  },
};

/**
 * Detect every protocol kernel: managed binary first, then any known binary
 * name on PATH (so an existing v2ray / ss-local / system ssh is found).
 * Returns per protocol: { installed, source, path, binary, version, installable }.
 */
export async function protocolStatus() {
  const out = {};
  for (const [name, def] of Object.entries(PROTOCOLS)) {
    const entry = { installed: false, source: null, path: null, binary: null, version: null, installable: !!def.installable };

    const primary = def.bins[0];
    const exe = process.platform === "win32" ? `${primary}.exe` : primary;
    const managed = path.join(BIN, exe);

    if (def.installable && fs.existsSync(managed)) {
      entry.installed = true;
      entry.source = "managed";
      entry.path = managed;
      entry.binary = primary;
    } else {
      for (const bin of def.detectBins) {
        const p = await onPath(bin);
        if (p) {
          entry.installed = true;
          entry.source = "path";
          entry.path = p;
          entry.binary = bin;
          break;
        }
      }
    }
    if (entry.path) entry.version = await getVersion(entry.path, def.versionArgs, def.versionRe);
    out[name] = entry;
  }
  return out;
}

/** Download + extract a protocol kernel from its official GitHub release. */
export async function installProtocol(name, onLog = () => {}) {
  const def = PROTOCOLS[name];
  if (!def) throw new Error(`unknown protocol kernel: ${name}`);
  if (!def.repo) throw new Error(`${name} is provided by the system and cannot be auto-installed`);
  const key = `${process.platform}:${process.arch}`;
  const needle = def.match[key];
  if (!needle) throw new Error(`no ${name} build for this platform (${key})`);

  ensureBin();
  onLog(`fetching latest ${name} release…`);
  const rel = await githubLatest(def.repo);
  const asset = rel.assets.find((a) => a.name.includes(needle) && /\.(zip|tar\.(gz|xz))$/.test(a.name));
  if (!asset) throw new Error(`no asset matching "${needle}" in ${def.repo} ${rel.tag_name}`);

  onLog(`downloading ${asset.name} (${(asset.size / 1e6).toFixed(1)} MB)…`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsune-kernel-"));
  const archive = path.join(tmpDir, asset.name);
  await download(asset.browser_download_url, archive);

  onLog("extracting…");
  await extract(archive, tmpDir);

  const installed = [];
  for (const bin of def.bins) {
    const found = findFile(tmpDir, bin) || findFile(tmpDir, `${bin}.exe`);
    if (!found) continue;
    const dest = path.join(BIN, path.basename(found));
    fs.copyFileSync(found, dest);
    fs.chmodSync(dest, 0o755);
    installed.push(dest);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (!installed.length) throw new Error(`archive did not contain expected binaries: ${def.bins.join(", ")}`);
  onLog(`installed ${installed.map((p) => path.basename(p)).join(", ")} -> ${BIN}`);
  return { installed, version: rel.tag_name };
}

// ---- helpers -------------------------------------------------------------

async function githubLatest(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": "kitsune", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "kitsune" } });
  if (!res.ok) throw new Error(`download ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

function extract(archive, destDir) {
  const isZip = archive.endsWith(".zip");
  const cmd = isZip ? "unzip" : "tar";
  const args = isZip ? ["-o", archive, "-d", destDir] : ["-xf", archive, "-C", destDir];
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(new Error(`extract failed (${cmd}): ${err.message}`)) : resolve()));
  });
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(full, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

function runStream(command, args, onLog, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env: process.env });
    let log = "";
    const cap = (d) => {
      const s = d.toString();
      log += s;
      onLog(s.replace(/\n$/, ""));
    };
    proc.stdout.on("data", cap);
    proc.stderr.on("data", cap);
    proc.on("error", (err) =>
      reject(err.code === "ENOENT" ? new Error(`'${command}' not found — is Node/npm on PATH?`) : err)
    );
    proc.on("exit", (code) =>
      code === 0 ? resolve({ ok: true, log }) : reject(new Error(`${label} failed (exit ${code}):\n${log.slice(-800)}`))
    );
  });
}

export const kernelPaths = { BIN };
