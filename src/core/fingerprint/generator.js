// Fingerprint generator: a per-profile seed + rich config -> a complete,
// self-consistent fingerprint. Pure and deterministic. Network-derived values
// ("based on IP") are resolved by the launcher beforehand and passed in via
// `resolved`; this function never does I/O.

import { rngFromSeed } from "../util/prng.js";
import {
  PRESETS,
  getPreset,
  CHROME_VERSION,
  CHROME_MAJOR,
  FONT_SETS,
  LOCALE_TZ,
  VOICES,
} from "./presets.js";
import { getEngine, ENGINE_VERSIONS, DEFAULT_ENGINE } from "../browser/engines.js";
import { defaultConfig, mergeConfig } from "../profile/config.js";

const FONTS_KEY = { Windows: "windows", macOS: "macos", Linux: "linux", Android: "linux", iOS: "macos" };

function geckoPlatform(os) {
  if (os === "Windows") return "Windows NT 10.0; Win64; x64";
  if (os === "macOS") return "Macintosh; Intel Mac OS X 10.15";
  return "X11; Linux x86_64";
}
function oscpuFor(os) {
  if (os === "Windows") return "Windows NT 10.0; Win64; x64";
  if (os === "macOS") return "Intel Mac OS X 10.15";
  return "Linux x86_64";
}

// Best-effort mobile identities for the Android / iOS OS options.
const MOBILE = {
  Android: {
    family: "chromium",
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Mobile Safari/537.36`,
    platform: "Linux armv8l",
    screen: { width: 412, height: 915, dpr: 2.625 },
    touch: 5,
  },
  iOS: {
    family: "webkit",
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/${ENGINE_VERSIONS.webkitBuild} (KHTML, like Gecko) Version/${ENGINE_VERSIONS.safari} Mobile/15E148 Safari/604.1`,
    platform: "iPhone",
    screen: { width: 390, height: 844, dpr: 3 },
    touch: 5,
  },
};

function buildUserAgent(preset, family) {
  if (family === "firefox") {
    const v = ENGINE_VERSIONS.firefox;
    return `Mozilla/5.0 (${geckoPlatform(preset.os)}; rv:${v}) Gecko/20100101 Firefox/${v}`;
  }
  if (family === "webkit") {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/${ENGINE_VERSIONS.webkitBuild} (KHTML, like Gecko) Version/${ENGINE_VERSIONS.safari} Safari/${ENGINE_VERSIONS.webkitBuild}`;
  }
  return `Mozilla/5.0 (${preset.uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
}

function buildUAMetadata(preset, mobile) {
  const brands = [
    { brand: "Not/A)Brand", version: "99" },
    { brand: "Google Chrome", version: String(CHROME_MAJOR) },
    { brand: "Chromium", version: String(CHROME_MAJOR) },
  ];
  return {
    brands,
    fullVersionList: brands.map((b) => ({ brand: b.brand, version: b.brand === "Not/A)Brand" ? "99.0.0.0" : CHROME_VERSION })),
    fullVersion: CHROME_VERSION,
    platform: preset.chPlatform,
    platformVersion: preset.chPlatformVersion,
    architecture: "x86",
    model: "",
    mobile: !!mobile,
    bitness: "64",
    wow64: false,
  };
}

function hexId(rng, len = 64) {
  let s = "";
  for (let i = 0; i < len; i++) s += "0123456789abcdef"[rng.int(0, 15)];
  return s;
}

function pickOsPreset(os, rng) {
  const family = { Windows: "win", macOS: "mac", Linux: "linux", iOS: "mac", Android: "linux" }[os];
  const matches = PRESETS.filter((p) => p.id.startsWith(family));
  return matches.length ? rng.pick(matches) : rng.pick(PRESETS);
}

/**
 * @param {object} opts
 * @param {string} opts.seed
 * @param {string} [opts.engine]
 * @param {string} [opts.os]        Windows|macOS|Linux|Android|iOS
 * @param {string} [opts.presetId]
 * @param {string} [opts.uaOverride]
 * @param {object} [opts.config]    fingerprint config (see profile/config.js)
 * @param {object} [opts.resolved]  IP-derived { timezone, languages, locale, geolocation }
 * @param {object} [opts.overrides]
 */
export function generateFingerprint({ seed, engine = DEFAULT_ENGINE, os, presetId, uaOverride, config, resolved = {}, overrides = {} } = {}) {
  if (!seed) throw new Error("generateFingerprint: seed is required");
  const cfg = mergeConfig(config || {});
  const rng = rngFromSeed(seed);
  let eng = getEngine(engine);

  const isMobile = os === "Android" || os === "iOS";
  const mob = isMobile ? MOBILE[os] : null;

  let preset = presetId ? getPreset(presetId) : os ? pickOsPreset(os, rng) : rng.pick(PRESETS);
  if (!preset) throw new Error(`unknown preset: ${presetId}`);
  if ((eng.family === "webkit" || os === "iOS") && preset.os !== "macOS") preset = getPreset("mac-apple-silicon");

  let family = mob ? mob.family : eng.family;
  const osName = os || preset.os;

  // ---- screen / resolution ----
  let screen;
  if (cfg.resolution.mode === "custom" && cfg.resolution.width) {
    screen = { width: cfg.resolution.width, height: cfg.resolution.height };
  } else if (mob) {
    screen = { width: mob.screen.width, height: mob.screen.height };
  } else {
    screen = rng.pick(preset.screens);
  }
  const dpr = mob ? mob.screen.dpr : rng.pick(preset.dpr);

  // ---- timezone / language / ui-language (honour modes) ----
  const localeTz = rng.pick(LOCALE_TZ);
  const hostTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hostLocale = Intl.DateTimeFormat().resolvedOptions().locale;

  const tz = cfg.timezone.mode === "custom" ? cfg.timezone.value
    : cfg.timezone.mode === "real" ? hostTz
    : resolved.timezone || localeTz.timezone;

  const languages = cfg.language.mode === "custom" ? cfg.language.value
    : resolved.languages || localeTz.languages;

  const locale = cfg.uiLanguage.mode === "custom" ? cfg.uiLanguage.value
    : cfg.uiLanguage.mode === "real" ? hostLocale
    : languages[0];

  // ---- webgl metadata ----
  const spoofMeta = cfg.webglMeta.mode !== "real";
  const unmaskedVendor = (spoofMeta && cfg.webglMeta.vendor) || preset.webglVendor;
  const unmaskedRenderer = (spoofMeta && cfg.webglMeta.renderer) || rng.pick(preset.webglRenderers);

  // ---- geolocation ----
  const g = cfg.geolocation;
  let position = null;
  if (g.mode === "custom" && g.lat != null) position = { latitude: g.lat, longitude: g.lon, accuracy: g.accuracy || 100 };
  else if (g.mode === "ip" && resolved.geolocation) position = resolved.geolocation;

  // ---- webrtc policy (5 modes -> injector/launcher semantics) ----
  const webrtcPolicy = cfg.webrtc === "disable" ? "disable"
    : cfg.webrtc === "real" || cfg.webrtc === "forward" ? "off"
    : "filter"; // proxy | replace

  const fontsKey = FONTS_KEY[osName] || preset.fonts;

  // ---- media devices (stable per profile) ----
  const groupA = hexId(rng);
  const mediaDevices = cfg.noise.mediaDevices
    ? [
        { kind: "audioinput", label: "", deviceId: hexId(rng), groupId: groupA },
        { kind: "videoinput", label: "", deviceId: hexId(rng), groupId: hexId(rng) },
        { kind: "audiooutput", label: "", deviceId: hexId(rng), groupId: groupA },
      ]
    : null;

  const noise = {
    canvas: rng.int(1, 8),
    canvasSeed: rng.int(1, 2 ** 30),
    audio: 1e-7 * (rng.int(1, 90) + 10),
    webgl: rng.int(1, 2 ** 30),
    clientRects: rng.int(1, 2 ** 30),
    flags: { ...cfg.noise },
  };

  const vendor = family === "webkit" ? "Apple Computer, Inc." : family === "firefox" ? "" : "Google Inc.";

  const fp = {
    seed,
    engine,
    engineFamily: family,
    os: osName,
    mobile: !!mob,
    presetId: preset.id,
    browserVersion: family === "firefox" ? ENGINE_VERSIONS.firefox : family === "webkit" ? ENGINE_VERSIONS.safari : CHROME_VERSION,

    userAgent: uaOverride || (mob ? mob.userAgent : buildUserAgent(preset, family)),
    userAgentMetadata: family === "chromium" ? buildUAMetadata(preset, !!mob) : null,
    platform: mob ? mob.platform : preset.platform,
    vendor,
    oscpu: family === "firefox" ? oscpuFor(osName) : null,
    productSub: family === "firefox" ? "20100101" : "20030107",
    buildID: family === "firefox" ? "20181001000000" : null,

    hardwareConcurrency: mob ? 8 : rng.pick(preset.cores),
    deviceMemory: family === "chromium" ? (mob ? 8 : rng.pick(preset.memory)) : null,
    maxTouchPoints: mob ? mob.touch : 0,

    locale,
    languages,
    timezone: tz,

    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.width,
      availHeight: screen.height - (osName === "macOS" ? 25 : mob ? 0 : 48),
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: dpr,
    },

    webgl: { vendor: "WebKit", renderer: "WebKit WebGL", unmaskedVendor, unmaskedRenderer, spoofMeta },
    webgpu: cfg.webgpu, // webgl | real | disable

    fonts: cfg.fonts.mode === "custom" && cfg.fonts.list.length ? cfg.fonts.list : FONT_SETS[fontsKey],
    spoofPlugins: family !== "firefox",
    voices: cfg.noise.speechVoices ? VOICES[fontsKey] || VOICES.macos : null,
    mediaDevices,

    geolocation: { mode: g.mode, permission: g.permission, position, block: g.mode === "block" },

    webrtc: cfg.webrtc,
    webrtcPolicy,

    noise,
  };

  return { ...fp, ...overrides };
}

export { PRESETS };
