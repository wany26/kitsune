// Coherent device presets.
//
// Detection engines flag *inconsistency* far more than any single odd value:
// a Win32 platform with a macOS UA, an Apple GPU on Windows, mobile UA on a
// 2560px screen. Each preset bundles values that co-occur on real machines so
// the generator can pick one bundle and stay internally consistent.

// A recent-but-not-bleeding-edge Chrome major keeps us in the fat part of the
// real-world distribution. Bump periodically.
export const CHROME_MAJOR = 127;
export const CHROME_VERSION = `${CHROME_MAJOR}.0.0.0`;

export const PRESETS = [
  {
    id: "win-nvidia",
    os: "Windows",
    platform: "Win32",
    uaPlatform: "Windows NT 10.0; Win64; x64",
    chPlatform: "Windows",
    chPlatformVersion: "15.0.0", // Win11 reports 13+ via CH; 15 = 24H2 era
    oscpu: null,
    webglVendor: "Google Inc. (NVIDIA)",
    webglRenderers: [
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    ],
    screens: [
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
      { width: 1536, height: 864 },
    ],
    dpr: [1, 1.25, 1.5],
    memory: [8, 16, 32],
    cores: [8, 12, 16],
    fonts: "windows",
  },
  {
    id: "win-intel",
    os: "Windows",
    platform: "Win32",
    uaPlatform: "Windows NT 10.0; Win64; x64",
    chPlatform: "Windows",
    chPlatformVersion: "15.0.0",
    oscpu: null,
    webglVendor: "Google Inc. (Intel)",
    webglRenderers: [
      "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
    ],
    screens: [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
    ],
    dpr: [1, 1.25],
    memory: [8, 16],
    cores: [4, 8],
    fonts: "windows",
  },
  {
    id: "mac-apple-silicon",
    os: "macOS",
    platform: "MacIntel", // Chrome still reports MacIntel on Apple Silicon
    uaPlatform: "Macintosh; Intel Mac OS X 10_15_7",
    chPlatform: "macOS",
    chPlatformVersion: "14.5.0",
    oscpu: null,
    webglVendor: "Google Inc. (Apple)",
    webglRenderers: [
      "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
      "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
      "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)",
    ],
    screens: [
      { width: 1512, height: 982 }, // 14" MBP logical
      { width: 1728, height: 1117 }, // 16" MBP logical
      { width: 1470, height: 956 },
    ],
    dpr: [2],
    memory: [8, 16, 24],
    cores: [8, 10, 12],
    fonts: "macos",
  },
  {
    id: "linux-mesa",
    os: "Linux",
    platform: "Linux x86_64",
    uaPlatform: "X11; Linux x86_64",
    chPlatform: "Linux",
    chPlatformVersion: "6.5.0",
    oscpu: "Linux x86_64",
    webglVendor: "Google Inc. (Intel)",
    webglRenderers: [
      "ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), OpenGL 4.6)",
      "ANGLE (AMD, AMD Radeon Graphics (radeonsi, renoir), OpenGL 4.6)",
    ],
    screens: [
      { width: 1920, height: 1080 },
      { width: 1680, height: 1050 },
    ],
    dpr: [1],
    memory: [8, 16],
    cores: [4, 8, 16],
    fonts: "linux",
  },
];

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

// Realistic font sets per OS. The injector uses these to answer font-probing
// (measuring text width per font) consistently instead of exposing the host's
// real installed fonts.
export const FONT_SETS = {
  windows: [
    "Arial", "Arial Black", "Calibri", "Cambria", "Cambria Math", "Comic Sans MS",
    "Consolas", "Courier New", "Georgia", "Impact", "Lucida Console",
    "Lucida Sans Unicode", "Microsoft Sans Serif", "Palatino Linotype",
    "Segoe UI", "Segoe UI Emoji", "Tahoma", "Times New Roman", "Trebuchet MS",
    "Verdana", "Webdings", "Wingdings",
  ],
  macos: [
    "American Typewriter", "Andale Mono", "Arial", "Arial Black", "Avenir",
    "Avenir Next", "Baskerville", "Big Caslon", "Courier", "Courier New",
    "Georgia", "Gill Sans", "Helvetica", "Helvetica Neue", "Hoefler Text",
    "Impact", "Lucida Grande", "Menlo", "Monaco", "Optima", "Palatino",
    "Times", "Times New Roman", "Trebuchet MS", "Verdana",
  ],
  linux: [
    "Bitstream Vera Sans", "Bitstream Vera Serif", "Bitstream Vera Sans Mono",
    "DejaVu Sans", "DejaVu Sans Mono", "DejaVu Serif", "FreeMono", "FreeSans",
    "FreeSerif", "Liberation Mono", "Liberation Sans", "Liberation Serif",
    "Noto Sans", "Ubuntu", "Ubuntu Mono",
  ],
};

// Common locale/timezone pairs. When a proxy pins a country, the launcher can
// override these; otherwise we pick a plausible pair.
export const LOCALE_TZ = [
  { locale: "en-US", languages: ["en-US", "en"], timezone: "America/New_York" },
  { locale: "en-US", languages: ["en-US", "en"], timezone: "America/Los_Angeles" },
  { locale: "en-GB", languages: ["en-GB", "en"], timezone: "Europe/London" },
  { locale: "de-DE", languages: ["de-DE", "de", "en"], timezone: "Europe/Berlin" },
  { locale: "fr-FR", languages: ["fr-FR", "fr", "en"], timezone: "Europe/Paris" },
];

// Curated WebGL vendor/renderer pairs offered in the "custom WebGL metadata"
// dropdowns. Kept realistic and grouped by GPU vendor.
export const WEBGL_OPTIONS = [
  { vendor: "Google Inc. (Intel)", renderer: "ANGLE (Intel, ANGLE Metal Renderer: Intel(R) UHD Graphics 630, Unspecified Version)" },
  { vendor: "Google Inc. (Intel)", renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (AMD)", renderer: "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (Apple)", renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)" },
  { vendor: "Google Inc. (Apple)", renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" },
];

// SpeechSynthesis voice lists reported by navigator per OS (subset).
export const VOICES = {
  windows: [
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
    { name: "Microsoft Mark - English (United States)", lang: "en-US" },
    { name: "Google US English", lang: "en-US" },
    { name: "Google UK English Female", lang: "en-GB" },
  ],
  macos: [
    { name: "Samantha", lang: "en-US" },
    { name: "Alex", lang: "en-US" },
    { name: "Daniel", lang: "en-GB" },
    { name: "Karen", lang: "en-AU" },
    { name: "Google US English", lang: "en-US" },
  ],
  linux: [
    { name: "Google US English", lang: "en-US" },
    { name: "Google UK English Male", lang: "en-GB" },
  ],
};

// Minimal country -> locale/timezone/geo used to resolve "based on IP" when the
// IP lookup only yields a country code (fallback), and to seed language.
export const COUNTRY_LOCALE = {
  US: { locale: "en-US", languages: ["en-US", "en"], timezone: "America/New_York" },
  GB: { locale: "en-GB", languages: ["en-GB", "en"], timezone: "Europe/London" },
  DE: { locale: "de-DE", languages: ["de-DE", "de", "en"], timezone: "Europe/Berlin" },
  FR: { locale: "fr-FR", languages: ["fr-FR", "fr", "en"], timezone: "Europe/Paris" },
  JP: { locale: "ja-JP", languages: ["ja-JP", "ja", "en"], timezone: "Asia/Tokyo" },
  SG: { locale: "en-SG", languages: ["en-SG", "en"], timezone: "Asia/Singapore" },
  HK: { locale: "zh-HK", languages: ["zh-HK", "zh", "en"], timezone: "Asia/Hong_Kong" },
  TW: { locale: "zh-TW", languages: ["zh-TW", "zh", "en"], timezone: "Asia/Taipei" },
};
