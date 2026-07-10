// Web UI server: a dependency-free Node http server that serves the shared
// frontend in ui/ and exposes the core library as a small REST API. The same
// renderer runs here as under Electron; only the transport differs.

import http from "node:http";
import fs from "node:fs";
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
} from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(__dirname, "../../ui");

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

/** profileId -> { dispose } for every live browser session. */
const sessions = new Map();

function withStatus(profiles) {
  return profiles.map((p) => ({ ...p, running: sessions.has(p.id) }));
}

const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// ---- REST routes ---------------------------------------------------------
async function handleApi(req, res, url) {
  const p = url.pathname.replace(/^\/api/, "");
  const method = req.method;
  let m;

  if (p === "/meta" && method === "GET") {
    return json(res, 200, {
      presets: PRESETS.map((x) => ({ id: x.id, os: x.os, gpu: x.webglVendor })),
      proxyTypes: SUPPORTED_PROXY_TYPES,
      engines: listEngines(),
      webgl: WEBGL_OPTIONS,
      home: paths.HOME,
    });
  }

  if (p === "/proxy/check" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, await checkProxy(body.spec, body.provider));
  }

  if (p === "/profiles" && method === "GET") return json(res, 200, withStatus(listProfiles()));
  if (p === "/profiles" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, withStatus([createProfile(body)])[0]);
  }
  if ((m = p.match(/^\/profiles\/([^/]+)$/))) {
    if (method === "PUT") return json(res, 200, updateProfile(m[1], await readBody(req)));
    if (method === "DELETE") {
      const s = sessions.get(m[1]);
      if (s) s.dispose();
      sessions.delete(m[1]);
      return json(res, 200, { deleted: deleteProfile(m[1]) });
    }
  }
  if ((m = p.match(/^\/profiles\/([^/]+)\/fingerprint$/)) && method === "GET") {
    const prof = getProfile(m[1]);
    if (!prof) return json(res, 404, { error: "profile not found" });
    return json(res, 200, generateFingerprint({
      seed: prof.seed, engine: prof.engine, os: prof.os, presetId: prof.presetId || undefined,
      uaOverride: prof.uaOverride || undefined, config: prof.config, overrides: prof.overrides,
    }));
  }

  if (p === "/sessions" && method === "GET") return json(res, 200, [...sessions.keys()]);
  if ((m = p.match(/^\/sessions\/([^/]+)\/launch$/)) && method === "POST") {
    const id = m[1];
    const prof = getProfile(id);
    if (!prof) return json(res, 404, { error: "profile not found" });
    if (sessions.has(id)) return json(res, 200, { running: true });
    const body = await readBody(req);
    const { context, dispose } = await launchProfile(prof, { url: body.url, headless: !!process.env.KITSUNE_HEADLESS });
    sessions.set(id, { dispose });
    context.on("close", () => sessions.delete(id));
    return json(res, 200, { running: true });
  }
  if ((m = p.match(/^\/sessions\/([^/]+)\/stop$/)) && method === "POST") {
    const s = sessions.get(m[1]);
    if (s) await s.dispose();
    sessions.delete(m[1]);
    return json(res, 200, { running: false });
  }

  if (p === "/kernels" && method === "GET") {
    return json(res, 200, { browsers: await browserStatus(), protocols: await protocolStatus() });
  }
  if ((m = p.match(/^\/kernels\/browser\/([^/]+)$/)) && method === "POST") {
    await installBrowser(m[1]);
    return json(res, 200, { ok: true });
  }
  if ((m = p.match(/^\/kernels\/protocol\/([^/]+)$/)) && method === "POST") {
    const result = await installProtocol(m[1]);
    return json(res, 200, result);
  }

  return json(res, 404, { error: "not found" });
}

// ---- static files --------------------------------------------------------
function serveStatic(req, res, url) {
  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = path.join(UI_DIR, rel);
  // Contain within UI_DIR.
  if (!file.startsWith(UI_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

export function startServer({ port = 4600, host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (err) {
      json(res, 500, { error: err.message || String(err) });
    }
  });

  const closeAll = () => {
    for (const s of sessions.values()) try { s.dispose(); } catch (e) {}
    sessions.clear();
  };
  process.once("exit", closeAll);
  process.once("SIGINT", () => { closeAll(); process.exit(0); });

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${port}` }));
  });
}
