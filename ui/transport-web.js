// Web transport. Under Electron, window.kitsune is already installed by the
// preload, so this file no-ops. In a plain browser it implements the same
// interface over the REST API served by src/web/server.js.

if (!window.kitsune) {
  const req = async (method, path, body) => {
    const res = await fetch("/api" + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `${method} ${path} -> ${res.status}`);
    return data;
  };

  let metaCache = null;
  const meta = async () => (metaCache = metaCache || (await req("GET", "/meta")));

  // Session-close detection by polling (browser has no push channel here).
  let closeCbs = [];
  let lastRunning = new Set();
  setInterval(async () => {
    try {
      const running = new Set(await req("GET", "/sessions"));
      for (const id of lastRunning) if (!running.has(id)) closeCbs.forEach((cb) => cb(id));
      lastRunning = running;
    } catch (e) {}
  }, 3000);

  window.kitsune = {
    listProfiles: () => req("GET", "/profiles"),
    createProfile: (opts) => req("POST", "/profiles", opts),
    updateProfile: (id, patch) => req("PUT", `/profiles/${id}`, patch),
    deleteProfile: (id) => req("DELETE", `/profiles/${id}`),
    fingerprint: (id) => req("GET", `/profiles/${id}/fingerprint`),

    presets: async () => (await meta()).presets,
    proxyTypes: async () => (await meta()).proxyTypes,
    engines: async () => (await meta()).engines,
    webglOptions: async () => (await meta()).webgl,
    checkProxy: (spec, provider) => req("POST", "/proxy/check", { spec, provider }),

    launch: (id, url) => req("POST", `/sessions/${id}/launch`, { url }),
    stop: (id) => req("POST", `/sessions/${id}/stop`),
    running: () => req("GET", "/sessions"),
    onSessionClosed: (cb) => closeCbs.push(cb),

    kernels: () => req("GET", "/kernels"),
    installBrowser: (engine) => req("POST", `/kernels/browser/${engine}`),
    installProtocol: (name) => req("POST", `/kernels/protocol/${name}`),

    openDataDir: async () => {
      const { home } = await req("GET", "/meta");
      alert(window.KitsuneI18n.t("js.dataDirAlert", { home }));
    },
  };
}
