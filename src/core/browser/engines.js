// Browser engine registry.
//
// A profile picks a device preset (OS/GPU/screen) *and* an engine. These are
// mostly orthogonal, with one constraint: WebKit ships only on Apple platforms,
// so a WebKit profile is always presented as macOS Safari (enforced in the
// generator). `family` drives which spoofing tricks apply — CDP client-hints,
// window.chrome and userAgentData are Chromium-only.

export const ENGINES = {
  chromium: { family: "chromium", label: "Chromium", pwType: "chromium", channel: null, cdp: true, browser: "chromium" },
  chrome:   { family: "chromium", label: "Google Chrome", pwType: "chromium", channel: "chrome", cdp: true, browser: "chrome" },
  edge:     { family: "chromium", label: "Microsoft Edge", pwType: "chromium", channel: "msedge", cdp: true, browser: "msedge" },
  firefox:  { family: "firefox", label: "Firefox", pwType: "firefox", channel: null, cdp: false, browser: "firefox" },
  webkit:   { family: "webkit", label: "WebKit / Safari", pwType: "webkit", channel: null, cdp: false, browser: "webkit" },
};

export const DEFAULT_ENGINE = "chromium";

// Version strings kept near the engines they describe. Bump periodically.
export const ENGINE_VERSIONS = {
  chrome: "127.0.0.0",
  chromeMajor: 127,
  firefox: "128.0",
  safari: "17.4",
  webkitBuild: "605.1.15",
};

export function getEngine(id) {
  return ENGINES[id] || ENGINES[DEFAULT_ENGINE];
}

export function listEngines() {
  return Object.entries(ENGINES).map(([id, e]) => ({ id, label: e.label, family: e.family }));
}
