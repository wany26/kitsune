// Fingerprint configuration schema.
//
// This mirrors the multi-tab profile editor: each setting is stored as a small
// { mode, ...value } object so the launcher can resolve "based on IP" at launch
// while custom/real values stay static. defaultConfig() is the single source of
// truth for shape + defaults; mergeConfig() fills gaps in a stored profile.

export function defaultConfig() {
  return {
    // Fingerprint tab
    webrtc: "disable", // forward | replace | real | disable | proxy
    timezone: { mode: "ip", value: "America/New_York" }, // ip | real | custom
    geolocation: { mode: "ip", permission: "ask", lat: null, lon: null, accuracy: 100 }, // ip | custom | block
    language: { mode: "ip", value: ["en-US", "en"] }, // ip | custom
    uiLanguage: { mode: "language", value: "en-US" }, // language | real | custom
    resolution: { mode: "ua", width: null, height: null }, // ua | custom
    fonts: { mode: "default", list: [] }, // default | custom
    noise: {
      canvas: true,
      webglImage: true,
      audio: true,
      mediaDevices: true,
      clientRects: true,
      speechVoices: true,
    },
    webglMeta: { mode: "custom", vendor: null, renderer: null }, // real | custom
    webgpu: "webgl", // webgl | real | disable
    randomize: false,
  };
}

/** Deep-merge a stored (possibly partial/old) config onto the defaults. */
export function mergeConfig(stored = {}) {
  const d = defaultConfig();
  const out = { ...d, ...stored };
  for (const k of ["timezone", "geolocation", "language", "uiLanguage", "resolution", "fonts", "webglMeta", "noise"]) {
    out[k] = { ...d[k], ...(stored[k] || {}) };
  }
  return out;
}

/** Fields a profile carries beyond id/seed/engine/proxy. */
export function defaultProfileExtras() {
  return {
    os: "macOS", // Windows | macOS | Linux | Android | iOS
    uaOverride: null, // custom User-Agent string, or null to derive
    note: "",
    cookies: [], // array of cookie objects (Playwright/Chrome DevTools shape)
    startupUrls: [], // tabs opened on launch
    accounts: [], // [{ platform, label }]
    ipQuery: "ip-api", // ip-api | ipwhois
    config: defaultConfig(),
  };
}
