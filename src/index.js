// Public library API — the single import surface an Electron GUI (or any other
// front-end) wraps. Everything the CLI does goes through these exports; the CLI
// adds no logic of its own beyond argument parsing.

export {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  userDataDir,
  paths,
} from "./core/profile/store.js";

export { launchProfile } from "./core/browser/launcher.js";
export { generateFingerprint, PRESETS } from "./core/fingerprint/generator.js";
export { resolveProxy, SUPPORTED_PROXY_TYPES } from "./core/proxy/index.js";
export { checkProxy, ipLookup } from "./core/proxy/ipcheck.js";
export { listEngines, ENGINES, DEFAULT_ENGINE } from "./core/browser/engines.js";
export { defaultConfig, mergeConfig, defaultProfileExtras } from "./core/profile/config.js";
export { WEBGL_OPTIONS, VOICES } from "./core/fingerprint/presets.js";
export {
  browserStatus,
  installBrowser,
  protocolStatus,
  installProtocol,
  resolveBinary,
} from "./core/kernels/index.js";
