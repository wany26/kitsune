// Shared renderer — runs identically under Electron (window.kitsune from preload)
// and in a browser (window.kitsune from transport-web.js). No framework, plain DOM.

const $ = (id) => document.getElementById(id);
const api = window.kitsune;
const t = window.KitsuneI18n.t;

let state = {
  profiles: [],
  presets: [],
  engines: [],
  selectedId: null,
  editing: undefined,
};

const NUM = "number";
const PROXY_SCHEMA = {
  none: [],
  http: proxied(),
  https: proxied(),
  socks5: proxied(),
  socks4: proxied(),
  shadowsocks: [f("server"), f("port", NUM), f("password", "password"), f("method", "text", "aes-256-gcm")],
  vmess: v2ray(true),
  vless: v2ray(false),
  trojan: [
    f("server"), f("port", NUM), f("password", "password"),
    f("network", "select", "tcp", ["tcp", "ws", "grpc"]),
    f("path", "text", "", null, true), f("host"), f("sni"), f("tls", "checkbox"),
  ],
  ssh: [
    f("host"), f("user"), f("port", NUM, "22"),
    f("identityFile", "text", "", null, true, "~/.ssh/id_ed25519"),
    f("password", "password"),
  ],
};
function proxied() { return [f("server"), f("port", NUM), f("username"), f("password", "password")]; }
function v2ray(isVmess) {
  const base = [
    f("server"), f("port", NUM), f("id", "text", "", null, true, "UUID"),
    f("network", "select", "tcp", ["tcp", "ws", "grpc"]),
    f("path", "text", "", null, true), f("host"), f("sni"), f("tls", "checkbox"),
  ];
  if (isVmess) base.splice(3, 0, f("alterId", NUM, "0"));
  else base.splice(3, 0, f("flow"));
  return base;
}
function f(name, type = "text", def = "", options = null, full = false, placeholder = "") {
  return { name, type, def, options, full, placeholder };
}

function show(which) {
  for (const id of ["detail", "form", "empty", "kernels"]) $(id).classList.toggle("hidden", id !== which);
}

// ---- profile list --------------------------------------------------------
function renderList() {
  const ul = $("profile-list");
  ul.innerHTML = "";
  $("profile-count").textContent = state.profiles.length;
  for (const p of state.profiles) {
    const li = document.createElement("li");
    li.className = "profile-item" + (p.id === state.selectedId ? " active" : "");
    li.innerHTML = `<span class="dot ${p.running ? "on" : ""}"></span>
      <div class="pi-main"><div class="pi-name"></div><div class="pi-meta"></div></div>`;
    li.querySelector(".pi-name").textContent = p.name;
    li.querySelector(".pi-meta").textContent =
      `${p.engine || "chromium"} · ${p.presetId || t("list.auto")} · ${p.proxy?.type && p.proxy.type !== "none" ? p.proxy.type : t("list.direct")}`;
    li.addEventListener("click", () => selectProfile(p.id));
    ul.appendChild(li);
  }
}

async function selectProfile(id) {
  state.selectedId = id;
  renderList();
  const p = state.profiles.find((x) => x.id === id);
  if (!p) return show("empty");

  const fp = await api.fingerprint(id);
  $("d-name").textContent = p.name;
  $("d-sub").textContent = `${p.id} · seed ${p.seed.slice(0, 12)}…`;
  setStatus(p.running);
  $("d-url").dataset.id = id;

  kv($("d-identity"), {
    [t("kv.engine")]: `${fp.engine} (${fp.engineFamily})`,
    [t("kv.os")]: fp.os,
    [t("kv.preset")]: fp.presetId,
    [t("kv.platform")]: fp.platform,
    [t("kv.cpuRam")]: `${fp.hardwareConcurrency} ${t("unit.cores")}${fp.deviceMemory ? " · " + fp.deviceMemory + " GB" : ""}`,
    [t("kv.screen")]: `${fp.screen.width}×${fp.screen.height} @${fp.screen.devicePixelRatio}x`,
    [t("kv.timezone")]: fp.timezone,
    [t("kv.languages")]: fp.languages.join(", "),
    [t("kv.gpu")]: shorten(fp.webgl.unmaskedRenderer, 34),
  });
  kv($("d-proxy"), proxySummary(p.proxy));
  $("d-fp").textContent = JSON.stringify(fp, null, 2);
  show("detail");
}

function proxySummary(proxy) {
  if (!proxy || proxy.type === "none") return { [t("kv.type")]: t("kv.directConnection") };
  const out = { [t("kv.type")]: proxy.type };
  if (proxy.server) out[t("kv.server")] = `${proxy.server}:${proxy.port ?? ""}`;
  if (proxy.host) out[t("kv.host")] = `${proxy.host}:${proxy.port ?? ""}`;
  if (proxy.user || proxy.username) out[t("kv.user")] = proxy.user || proxy.username;
  if (proxy.method) out[t("kv.method")] = proxy.method;
  if (proxy.network) out[t("kv.transport")] = proxy.network + (proxy.tls ? " + TLS" : "");
  if (proxy.password || proxy.id) out[t("kv.secret")] = "••••••••";
  return out;
}

function setStatus(running) {
  const pill = $("d-status");
  pill.textContent = running ? t("status.running") : t("status.stopped");
  pill.classList.toggle("running", running);
  $("btn-launch").classList.toggle("hidden", running);
  $("btn-stop").classList.toggle("hidden", !running);
}

function kv(dl, obj) {
  dl.innerHTML = "";
  for (const [k, v] of Object.entries(obj)) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.append(dt, dd);
  }
}
const shorten = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");

// ---- form ----------------------------------------------------------------
const NOISE_KEYS = ["canvas", "webglImage", "audio", "mediaDevices", "clientRects", "speechVoices"];

function clientDefaultConfig() {
  return {
    webrtc: "disable",
    timezone: { mode: "ip", value: "America/New_York" },
    geolocation: { mode: "ip", permission: "ask", lat: null, lon: null, accuracy: 100 },
    language: { mode: "ip", value: ["en-US", "en"] },
    uiLanguage: { mode: "language", value: "en-US" },
    resolution: { mode: "ua", width: null, height: null },
    fonts: { mode: "default", list: [] },
    noise: { canvas: true, webglImage: true, audio: true, mediaDevices: true, clientRects: true, speechVoices: true },
    webglMeta: { mode: "custom", vendor: null, renderer: null },
    webgpu: "webgl",
    randomize: false,
  };
}
function mergeCfg(cfg = {}) {
  const d = clientDefaultConfig();
  const out = { ...d, ...cfg };
  ["timezone", "geolocation", "language", "uiLanguage", "resolution", "fonts", "webglMeta", "noise"].forEach((k) => (out[k] = { ...d[k], ...(cfg[k] || {}) }));
  return out;
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-body").forEach((s) => s.classList.toggle("hidden", s.dataset.tab !== name));
}

// Show/hide the detail inputs governed by each mode <select>.
function applyModes() {
  document.querySelectorAll(".field .mode").forEach((sel) => {
    const scope = sel.closest(".field");
    scope.querySelectorAll("[data-when]").forEach((el) => (el.style.display = el.getAttribute("data-when") === sel.value ? "" : "none"));
  });
  document.querySelectorAll("[data-when-res]").forEach((el) => (el.style.display = el.getAttribute("data-when-res") === $("f-res-mode").value ? "" : "none"));
  document.querySelectorAll("[data-when-webgl]").forEach((el) => (el.style.display = el.getAttribute("data-when-webgl") === $("f-webgl-mode").value ? "" : "none"));
  document.querySelectorAll("[data-geo-custom]").forEach((el) => (el.style.display = $("f-geo-mode").value === "custom" ? "" : "none"));
}

function fillWebgl(vendor, renderer) {
  const vendors = [...new Set(state.webgl.map((w) => w.vendor))];
  fillSelect($("f-webgl-vendor"), vendors.map((v) => ({ v, t: v })));
  $("f-webgl-vendor").value = vendor && vendors.includes(vendor) ? vendor : vendors[0];
  fillWebglRenderers(renderer);
}
function fillWebglRenderers(renderer) {
  const v = $("f-webgl-vendor").value;
  const rs = state.webgl.filter((w) => w.vendor === v).map((w) => w.renderer);
  fillSelect($("f-webgl-renderer"), rs.map((r) => ({ v: r, t: r })));
  if (renderer && rs.includes(renderer)) $("f-webgl-renderer").value = renderer;
}

function miniRow(container, fields, values = []) {
  const row = document.createElement("div");
  row.className = "mini-row";
  fields.forEach((ph, i) => {
    const inp = document.createElement("input");
    inp.className = "input";
    inp.placeholder = ph;
    inp.value = values[i] || "";
    row.appendChild(inp);
  });
  const rm = document.createElement("button");
  rm.className = "rm";
  rm.textContent = "✕";
  rm.onclick = () => row.remove();
  row.appendChild(rm);
  container.appendChild(row);
}
const addTabRow = (url = "") => miniRow($("f-tabs"), ["https://…"], [url]);
const addAccountRow = (platform = "", label = "") =>
  miniRow($("f-accounts"), [t("form.accounts.platformPlaceholder"), t("form.accounts.labelPlaceholder")], [platform, label]);

function updateCount(inputId, countId, max) {
  const el = $(inputId), c = $(countId);
  const upd = () => (c.textContent = `${el.value.length} / ${max}`);
  upd();
  el.oninput = upd;
}

function openForm(profile) {
  state.editing = profile || null;
  state.formSeed = null;
  const p = profile || {};
  const c = mergeCfg(p.config);
  $("form-title").textContent = profile ? t("form.editProfile", { name: p.name }) : t("form.newProfile");

  $("f-name").value = p.name || "";
  $("f-name").disabled = !!profile;
  updateCount("f-name", "f-name-count", 100);
  $("f-note").value = p.note || "";
  updateCount("f-note", "f-note-count", 20000);

  fillSelect($("f-engine"), state.engines.map((e) => ({ v: e.id, t: `${e.label} — ${e.family}` })));
  $("f-engine").value = p.engine || "chromium";
  fillSelect($("f-os"), ["Windows", "macOS", "Linux", "Android", "iOS"].map((o) => ({ v: o, t: o })));
  $("f-os").value = p.os || "macOS";
  fillSelect($("f-preset"), [{ v: "", t: t("form.basic.preset.auto") }, ...state.presets.map((x) => ({ v: x.id, t: `${x.id} — ${x.os}` }))]);
  $("f-preset").value = p.presetId || "";

  $("f-ua-mode").value = p.uaOverride ? "custom" : "auto";
  $("f-ua").value = p.uaOverride || "";
  $("f-cookies").value = p.cookies && p.cookies.length ? JSON.stringify(p.cookies, null, 2) : "";

  const type = p.proxy?.type || "none";
  $("f-proxy-type").value = type;
  renderProxyFields(type, p.proxy || {});
  $("f-ipquery").value = p.ipQuery || "ip-api";
  $("proxy-result").classList.add("hidden");

  $("f-tabs").innerHTML = "";
  (p.startupUrls || []).forEach(addTabRow);
  $("f-accounts").innerHTML = "";
  (p.accounts || []).forEach((a) => addAccountRow(a.platform, a.label));

  $("f-webrtc").value = c.webrtc;
  $("f-tz-mode").value = c.timezone.mode;
  $("f-tz").value = c.timezone.value || "";
  $("f-lang-mode").value = c.language.mode;
  $("f-lang").value = (c.language.value || []).join(",");
  $("f-uilang-mode").value = c.uiLanguage.mode;
  $("f-uilang").value = c.uiLanguage.value || "";
  $("f-geo-mode").value = c.geolocation.mode;
  $("f-geo-perm").value = c.geolocation.permission;
  $("f-geo-lat").value = c.geolocation.lat ?? "";
  $("f-geo-lon").value = c.geolocation.lon ?? "";
  $("f-res-mode").value = c.resolution.mode;
  $("f-res-w").value = c.resolution.width ?? "";
  $("f-res-h").value = c.resolution.height ?? "";
  $("f-fonts-mode").value = c.fonts.mode;
  $("f-fonts").value = (c.fonts.list || []).join(", ");
  NOISE_KEYS.forEach((k) => ($("n-" + k).checked = c.noise[k] !== false));
  $("f-webgl-mode").value = c.webglMeta.mode;
  fillWebgl(c.webglMeta.vendor, c.webglMeta.renderer);
  $("f-webgpu").value = c.webgpu;
  $("f-random").checked = !!c.randomize;

  $("f-seed").value = p.seed || t("form.adv.seedUnset");

  $("form-error").classList.add("hidden");
  switchTab("basic");
  applyModes();
  show("form");
}

function parseCookies() {
  const raw = $("f-cookies").value.trim();
  if (!raw) return [];
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) throw new Error(t("form.error.cookiesArray"));
  return arr;
}

function collectConfig() {
  const val = (id) => $(id).value.trim();
  const num = (id) => ($(id).value === "" ? null : Number($(id).value));
  return {
    webrtc: $("f-webrtc").value,
    timezone: { mode: $("f-tz-mode").value, value: val("f-tz") || "America/New_York" },
    language: { mode: $("f-lang-mode").value, value: val("f-lang") ? val("f-lang").split(",").map((s) => s.trim()) : ["en-US", "en"] },
    uiLanguage: { mode: $("f-uilang-mode").value, value: val("f-uilang") || "en-US" },
    geolocation: { mode: $("f-geo-mode").value, permission: $("f-geo-perm").value, lat: num("f-geo-lat"), lon: num("f-geo-lon"), accuracy: 100 },
    resolution: { mode: $("f-res-mode").value, width: num("f-res-w"), height: num("f-res-h") },
    fonts: { mode: $("f-fonts-mode").value, list: val("f-fonts") ? val("f-fonts").split(",").map((s) => s.trim()).filter(Boolean) : [] },
    noise: Object.fromEntries(NOISE_KEYS.map((k) => [k, $("n-" + k).checked])),
    webglMeta: { mode: $("f-webgl-mode").value, vendor: $("f-webgl-vendor").value, renderer: $("f-webgl-renderer").value },
    webgpu: $("f-webgpu").value,
    randomize: $("f-random").checked,
  };
}

function collectProfile() {
  const startupUrls = [...$("f-tabs").querySelectorAll("input")].map((i) => i.value.trim()).filter(Boolean);
  const accounts = [...$("f-accounts").querySelectorAll(".mini-row")]
    .map((r) => { const [a, b] = r.querySelectorAll("input"); return { platform: a.value.trim(), label: b.value.trim() }; })
    .filter((x) => x.platform || x.label);
  const data = {
    engine: $("f-engine").value,
    os: $("f-os").value,
    presetId: $("f-preset").value || null,
    uaOverride: $("f-ua-mode").value === "custom" ? $("f-ua").value.trim() || null : null,
    note: $("f-note").value,
    cookies: parseCookies(),
    startupUrls,
    accounts,
    ipQuery: $("f-ipquery").value,
    proxy: collectProxySpec(),
    config: collectConfig(),
  };
  if (state.formSeed) data.seed = state.formSeed;
  return data;
}

async function checkProxyUI() {
  const box = $("proxy-result");
  const btn = $("btn-check-proxy");
  box.className = "proxy-result";
  box.textContent = t("form.proxy.checking");
  btn.disabled = true;
  try {
    const r = await api.checkProxy(collectProxySpec(), $("f-ipquery").value);
    if (r.ok) {
      box.classList.add("ok");
      box.innerHTML = t("form.proxy.resultOk", {
        ms: r.ms,
        ip: r.ip,
        city: r.city || "",
        country: r.country || "",
        cc: r.countryCode || "?",
        timezone: r.timezone || "?",
        isp: r.isp ? " · " + r.isp : "",
      });
    } else {
      box.classList.add("bad");
      box.textContent = t("form.proxy.failed", { error: r.error || t("common.unknown") });
    }
  } catch (e) {
    box.classList.add("bad");
    box.textContent = t("form.proxy.error", { error: e.message || e });
  } finally {
    btn.disabled = false;
  }
}

function renderProxyFields(type, values) {
  const wrap = $("f-proxy-fields");
  wrap.innerHTML = "";
  for (const field of PROXY_SCHEMA[type] || []) {
    const label = document.createElement("label");
    label.className = "field" + (field.full ? " full" : "") + (field.type === "checkbox" ? " check" : "");
    const span = document.createElement("span");
    span.textContent = t("proxyField." + field.name);

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      input.className = "input";
      fillSelect(input, field.options.map((o) => ({ v: o, t: o })));
    } else {
      input = document.createElement("input");
      input.className = "input";
      input.type = field.type === NUM ? "number" : field.type;
      input.placeholder = field.placeholder || "";
    }
    input.dataset.name = field.name;

    const cur = values[field.name];
    if (field.type === "checkbox") {
      input.checked = cur ?? false;
      label.append(input, span);
    } else {
      input.value = cur ?? field.def ?? "";
      label.append(span, input);
    }
    wrap.appendChild(label);
  }
}

function collectProxySpec() {
  const type = $("f-proxy-type").value;
  const spec = { type };
  if (type === "none") return spec;
  for (const input of $("f-proxy-fields").querySelectorAll("[data-name]")) {
    const name = input.dataset.name;
    if (input.type === "checkbox") spec[name] = input.checked;
    else if (input.value !== "") spec[name] = input.type === "number" ? Number(input.value) : input.value;
  }
  return spec;
}

async function saveForm() {
  try {
    const data = collectProfile();
    if (state.editing) {
      await api.updateProfile(state.editing.id, data);
      await refresh(state.editing.id);
    } else {
      const name = $("f-name").value.trim();
      if (!name) throw new Error(t("form.error.nameRequired"));
      const created = await api.createProfile({ name, ...data });
      await refresh(created.id);
    }
  } catch (err) {
    const box = $("form-error");
    box.textContent = err.message || String(err);
    box.classList.remove("hidden");
  }
}

// ---- kernels view --------------------------------------------------------
async function openKernels() {
  show("kernels");
  await renderKernels();
}

function sourceLabel(src) {
  const key = { playwright: "kernels.source.playwright", system: "kernels.source.system", managed: "kernels.source.managed", path: "kernels.source.path" }[src];
  return key ? t(key) : src;
}

async function renderKernels() {
  const status = await api.kernels();
  const kb = $("k-browsers");
  const kp = $("k-protocols");
  kb.innerHTML = "";
  kp.innerHTML = "";

  for (const [id, s] of Object.entries(status.browsers)) {
    kb.appendChild(kernelRow({
      name: id,
      meta: s.installed
        ? `${s.path}${s.version ? "  ·  " + s.version : ""}`
        : s.kind === "channel" ? t("kernels.systemBrowserNotFound") : t("kernels.notDownloaded"),
      badge: s.installed ? ["ok", sourceLabel(s.source)] : ["no", s.kind === "channel" ? t("kernels.notFound") : t("kernels.notInstalled")],
      // Only Playwright-managed engines can be downloaded; a channel browser
      // must be installed by the user.
      canInstall: s.kind === "managed" && !s.installed,
      installLabel: t("kernels.download"),
      onInstall: (log) => api.installBrowser(id).then(log),
    }));
  }
  for (const [name, s] of Object.entries(status.protocols)) {
    const alt = s.binary && s.binary !== name ? `  (${s.binary})` : "";
    kp.appendChild(kernelRow({
      name,
      meta: s.installed ? `${s.path}${s.version ? "  ·  " + s.version : ""}${alt}` : "",
      badge: s.installed ? [s.source === "managed" ? "ok" : "sys", sourceLabel(s.source)] : ["no", s.installable ? t("kernels.notInstalled") : t("kernels.notFound")],
      canInstall: s.installable && (!s.installed || s.source === "path"),
      installLabel: s.installed ? t("kernels.installManagedCopy") : t("kernels.install"),
      onInstall: (log) => api.installProtocol(name).then(log),
    }));
  }
}

function kernelRow({ name, meta, badge, canInstall, installLabel, onInstall }) {
  installLabel = installLabel ?? t("kernels.install");
  const row = document.createElement("div");
  row.className = "kernel-row";
  row.innerHTML = `<div><div class="k-name"></div><div class="k-meta mono"></div></div>
    <span class="grow"></span><span class="badge ${badge[0]}"></span>`;
  row.querySelector(".k-name").textContent = name;
  row.querySelector(".k-meta").textContent = meta;
  row.querySelector(".badge").textContent = badge[1];
  if (canInstall) {
    const btn = document.createElement("button");
    btn.className = "btn primary sm";
    btn.textContent = installLabel;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = t("kernels.installing");
      const logEl = $("k-log");
      logEl.classList.remove("hidden");
      logEl.textContent = t("kernels.installingLog", { name });
      try {
        await onInstall(() => {});
        logEl.textContent += t("kernels.done");
        await renderKernels();
      } catch (err) {
        logEl.textContent += t("kernels.errorLog", { error: err.message || err });
        btn.disabled = false;
        btn.textContent = installLabel;
      }
    });
    row.appendChild(btn);
  }
  return row;
}

// ---- session actions -----------------------------------------------------
async function launch() {
  const id = state.selectedId;
  const url = $("d-url").value.trim() || undefined;
  const btn = $("btn-launch");
  btn.disabled = true;
  btn.textContent = t("js.launching");
  try {
    await api.launch(id, url);
    markRunning(id, true);
  } catch (err) {
    alert(t("js.launchFailed", { error: err.message || err }));
  } finally {
    btn.disabled = false;
    btn.textContent = t("detail.launch");
  }
}
async function stop() {
  const id = state.selectedId;
  await api.stop(id);
  markRunning(id, false);
}
function markRunning(id, running) {
  const p = state.profiles.find((x) => x.id === id);
  if (p) p.running = running;
  if (state.selectedId === id) setStatus(running);
  renderList();
}

// ---- bootstrap -----------------------------------------------------------
function fillSelect(sel, items) {
  sel.innerHTML = "";
  for (const it of items) {
    const o = document.createElement("option");
    o.value = it.v;
    o.textContent = it.t;
    sel.appendChild(o);
  }
}

async function refresh(selectId) {
  state.profiles = await api.listProfiles();
  const running = new Set(await api.running());
  state.profiles.forEach((p) => (p.running = running.has(p.id)));
  renderList();
  if (selectId) await selectProfile(selectId);
  else if (!state.profiles.length) show("empty");
}

async function init() {
  state.presets = await api.presets();
  state.engines = await api.engines();
  state.webgl = (await api.webglOptions()) || [];
  const types = await api.proxyTypes();
  fillSelect($("f-proxy-type"), types.map((t) => ({ v: t, t })));
  $("f-proxy-type").addEventListener("change", (e) => renderProxyFields(e.target.value, {}));

  // Tabs + mode-driven visibility.
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $("form").addEventListener("change", (e) => {
    if (e.target.classList.contains("mode") || ["f-res-mode", "f-webgl-mode", "f-geo-mode"].includes(e.target.id)) applyModes();
  });
  $("f-webgl-vendor").addEventListener("change", () => fillWebglRenderers());
  $("btn-add-tab").addEventListener("click", () => addTabRow());
  $("btn-add-account").addEventListener("click", () => addAccountRow());
  $("btn-check-proxy").addEventListener("click", checkProxyUI);
  $("btn-reseed").addEventListener("click", () => {
    const seed = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    state.formSeed = seed;
    $("f-seed").value = seed;
  });

  $("btn-new").addEventListener("click", () => openForm(null));
  $("btn-new-2").addEventListener("click", () => openForm(null));
  $("btn-cancel").addEventListener("click", () => (state.selectedId ? selectProfile(state.selectedId) : show("empty")));
  $("btn-save").addEventListener("click", saveForm);
  $("btn-edit").addEventListener("click", () => openForm(state.profiles.find((p) => p.id === state.selectedId)));
  $("btn-launch").addEventListener("click", launch);
  $("btn-stop").addEventListener("click", stop);
  $("btn-open-data").addEventListener("click", () => api.openDataDir());
  $("btn-kernels").addEventListener("click", openKernels);
  $("btn-kernels-close").addEventListener("click", () => (state.selectedId ? selectProfile(state.selectedId) : show("empty")));
  $("btn-delete").addEventListener("click", async () => {
    const p = state.profiles.find((x) => x.id === state.selectedId);
    if (p && confirm(t("js.deleteConfirm", { name: p.name }))) {
      await api.deleteProfile(p.id);
      state.selectedId = null;
      await refresh();
      if (!state.profiles.length) show("empty");
    }
  });

  // Language toggle: button always shows the language you'd switch *to*.
  const updateLangBtn = () => ($("btn-lang").textContent = KitsuneI18n.getLang() === "zh" ? "EN" : "中文");
  updateLangBtn();
  $("btn-lang").addEventListener("click", () => {
    KitsuneI18n.setLang(KitsuneI18n.getLang() === "zh" ? "en" : "zh");
  });
  KitsuneI18n.onChange(async () => {
    updateLangBtn();
    renderList();
    if (!$("form").classList.contains("hidden")) {
      // Form is mid-edit: applyStaticI18n() already relabeled everything with
      // data-i18n; don't rebuild the form itself or it would discard unsaved
      // input/selections. Just patch the couple of JS-only dynamic bits.
      $("form-title").textContent = state.editing ? t("form.editProfile", { name: state.editing.name }) : t("form.newProfile");
      const autoOpt = $("f-preset").querySelector('option[value=""]');
      if (autoOpt) autoOpt.textContent = t("form.basic.preset.auto");
      // The seed field's placeholder text is a JS-set .value, not covered by
      // data-i18n — only re-translate it if it's still showing that placeholder
      // (i.e. no real seed has been assigned yet for this new profile).
      if (!state.formSeed && !(state.editing && state.editing.seed)) $("f-seed").value = t("form.adv.seedUnset");
      // Proxy field labels (server/port/password/…) are built dynamically by
      // renderProxyFields() with no data-i18n hook; re-label in place using the
      // field name already stashed on each input, without touching its value.
      $("f-proxy-fields").querySelectorAll("[data-name]").forEach((input) => {
        const span = input.closest(".field").querySelector("span");
        if (span) span.textContent = t("proxyField." + input.dataset.name);
      });
    } else if (!$("detail").classList.contains("hidden") && state.selectedId) {
      await selectProfile(state.selectedId);
    } else if (!$("kernels").classList.contains("hidden")) {
      await renderKernels();
    }
  });

  api.onSessionClosed((id) => markRunning(id, false));
  await refresh();
}

init();
