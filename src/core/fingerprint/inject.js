// Page-side fingerprint injection.
//
// `fingerprintPageScript` is serialized and installed via
// context.addInitScript(fingerprintPageScript, fp) so it runs in every frame
// *before* any page/site script. It must be fully self-contained: no imports,
// no closure over module scope — only its single `fp` argument.
//
// Design rules that matter for evading detection:
//   * Patch prototypes, not instances, and keep property descriptors native-ish.
//   * Every replaced function must report "[native code]" via toString.
//   * All noise derives from fp.noise seeds -> stable per profile, unique across.
//   * Wrap each patch in try/catch so a single failure never white-screens a site.

export function fingerprintPageScript(fp) {
  "use strict";

  // ---- toString cloaking -------------------------------------------------
  // Make patched functions indistinguishable from native ones. We keep a map
  // of override -> the string it should report, and route through a single
  // patched Function.prototype.toString.
  const nativeToString = Function.prototype.toString;
  const fakeSources = new WeakMap();

  function defineNative(obj, name, value, sourceName) {
    fakeSources.set(value, `function ${sourceName || name}() { [native code] }`);
    return value;
  }

  const patchedToString = function toString() {
    if (fakeSources.has(this)) return fakeSources.get(this);
    return nativeToString.call(this);
  };
  fakeSources.set(patchedToString, "function toString() { [native code] }");
  try {
    Function.prototype.toString = patchedToString;
  } catch (e) {}

  // Replace a getter on a prototype/object with a native-looking one.
  function spoofGetter(target, prop, getter, name) {
    try {
      const g = defineNative({}, `get ${prop}`, getter, `get ${prop}`);
      Object.defineProperty(target, prop, {
        get: g,
        set: undefined,
        enumerable: true,
        configurable: true,
      });
    } catch (e) {}
  }

  function spoofValue(target, prop, value) {
    try {
      Object.defineProperty(target, prop, {
        value,
        writable: false,
        enumerable: true,
        configurable: true,
      });
    } catch (e) {}
  }

  // Small deterministic PRNG for noise (mulberry32).
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const Nav = window.Navigator.prototype;
  const Scr = window.Screen.prototype;

  // ---- navigator ---------------------------------------------------------
  try {
    spoofGetter(Nav, "userAgent", () => fp.userAgent);
    spoofGetter(Nav, "platform", () => fp.platform);
    spoofGetter(Nav, "vendor", () => fp.vendor);
    spoofGetter(Nav, "language", () => fp.languages[0]);
    spoofGetter(Nav, "languages", () => Object.freeze([...fp.languages]));
    spoofGetter(Nav, "hardwareConcurrency", () => fp.hardwareConcurrency);
    // deviceMemory exists only on Chromium; elsewhere leave it native (undefined).
    if (fp.deviceMemory != null) spoofGetter(Nav, "deviceMemory", () => fp.deviceMemory);
    spoofGetter(Nav, "maxTouchPoints", () => fp.maxTouchPoints);
    spoofGetter(Nav, "productSub", () => fp.productSub);
    if (fp.oscpu) spoofGetter(Nav, "oscpu", () => fp.oscpu); // Firefox-only
    if (fp.buildID) spoofGetter(Nav, "buildID", () => fp.buildID); // Firefox-only

    // The single loudest automation tell.
    spoofGetter(Nav, "webdriver", () => false);
  } catch (e) {}

  // ---- navigator.userAgentData (Client Hints, JS surface) ----------------
  // Chromium only — Firefox/WebKit have no userAgentData, so faking one would
  // itself be a tell.
  try {
    if (fp.engineFamily === "chromium" && fp.userAgentMetadata) {
    const meta = fp.userAgentMetadata;
    const uaData = {
      brands: meta.brands.map((b) => ({ brand: b.brand, version: b.version })),
      mobile: meta.mobile,
      platform: meta.platform,
      getHighEntropyValues(hints) {
        const all = {
          architecture: meta.architecture,
          bitness: meta.bitness,
          brands: meta.brands,
          fullVersionList: meta.fullVersionList,
          mobile: meta.mobile,
          model: meta.model,
          platform: meta.platform,
          platformVersion: meta.platformVersion,
          uaFullVersion: meta.fullVersion,
          wow64: meta.wow64,
        };
        const out = { brands: all.brands, mobile: all.mobile, platform: all.platform };
        (hints || []).forEach((h) => {
          if (h in all) out[h] = all[h];
        });
        return Promise.resolve(out);
      },
      toJSON() {
        return { brands: this.brands, mobile: this.mobile, platform: this.platform };
      },
    };
    defineNative(uaData, "getHighEntropyValues", uaData.getHighEntropyValues);
    spoofGetter(Nav, "userAgentData", () => uaData);
    }
  } catch (e) {}

  // ---- navigator.plugins / mimeTypes (modern Chrome PDF set) -------------
  // Firefox exposes a different, native plugin set; only spoof where it helps.
  try {
    if (fp.spoofPlugins) {
    const pdfMimes = [
      { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
      { type: "text/pdf", suffixes: "pdf", description: "Portable Document Format" },
    ];
    const pluginData = [
      { name: "PDF Viewer", filename: "internal-pdf-viewer" },
      { name: "Chrome PDF Viewer", filename: "internal-pdf-viewer" },
      { name: "Chromium PDF Viewer", filename: "internal-pdf-viewer" },
      { name: "Microsoft Edge PDF Viewer", filename: "internal-pdf-viewer" },
      { name: "WebKit built-in PDF", filename: "internal-pdf-viewer" },
    ];
    const mimeArr = pdfMimes.map((m) => Object.create(MimeType.prototype, {
      type: { value: m.type, enumerable: true },
      suffixes: { value: m.suffixes, enumerable: true },
      description: { value: m.description, enumerable: true },
    }));
    const plugins = pluginData.map((p) => {
      const plugin = Object.create(Plugin.prototype, {
        name: { value: p.name, enumerable: true },
        filename: { value: p.filename, enumerable: true },
        description: { value: "Portable Document Format", enumerable: true },
        length: { value: pdfMimes.length, enumerable: true },
      });
      mimeArr.forEach((mm, i) => {
        Object.defineProperty(plugin, i, { value: mm, enumerable: true });
      });
      return plugin;
    });
    const pluginArray = Object.create(PluginArray.prototype);
    plugins.forEach((p, i) => Object.defineProperty(pluginArray, i, { value: p, enumerable: true }));
    Object.defineProperty(pluginArray, "length", { value: plugins.length });
    spoofGetter(Nav, "plugins", () => pluginArray);
    }
  } catch (e) {}

  // ---- screen & window metrics -------------------------------------------
  try {
    const s = fp.screen;
    spoofGetter(Scr, "width", () => s.width);
    spoofGetter(Scr, "height", () => s.height);
    spoofGetter(Scr, "availWidth", () => s.availWidth);
    spoofGetter(Scr, "availHeight", () => s.availHeight);
    spoofGetter(Scr, "availLeft", () => 0);
    spoofGetter(Scr, "availTop", () => 0);
    spoofGetter(Scr, "colorDepth", () => s.colorDepth);
    spoofGetter(Scr, "pixelDepth", () => s.pixelDepth);
    spoofValue(window, "devicePixelRatio", s.devicePixelRatio);
  } catch (e) {}

  // ---- canvas noise ------------------------------------------------------
  // Perturb a deterministic handful of pixels so the hash differs per profile
  // but the image is visually identical. Same draw + same seed -> same output.
  try {
    if (fp.noise.flags.canvas) {
    const seed = fp.noise.canvasSeed >>> 0;
    function jitter(imageData) {
      const d = imageData.data;
      const rng = makeRng(seed ^ (d.length & 0xffffffff));
      const touches = fp.noise.canvas;
      for (let k = 0; k < touches; k++) {
        const i = Math.floor(rng() * (d.length / 4)) * 4;
        d[i] = d[i] ^ (rng() < 0.5 ? 1 : 0); // flip low bit of R
        d[i + 1] = d[i + 1] ^ (rng() < 0.5 ? 1 : 0); // and G
      }
      return imageData;
    }

    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const patchedGetImageData = function getImageData(...args) {
      const data = origGetImageData.apply(this, args);
      return jitter(data);
    };
    defineNative(patchedGetImageData, "getImageData", patchedGetImageData);
    CanvasRenderingContext2D.prototype.getImageData = patchedGetImageData;

    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const patchedToDataURL = function toDataURL(...args) {
      try {
        const ctx = this.getContext("2d");
        if (ctx && this.width && this.height) {
          const img = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          ctx.putImageData(jitter(img), 0, 0);
        }
      } catch (e) {}
      return origToDataURL.apply(this, args);
    };
    defineNative(patchedToDataURL, "toDataURL", patchedToDataURL);
    HTMLCanvasElement.prototype.toDataURL = patchedToDataURL;

    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    const patchedToBlob = function toBlob(cb, ...rest) {
      try {
        const ctx = this.getContext("2d");
        if (ctx && this.width && this.height) {
          const img = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          ctx.putImageData(jitter(img), 0, 0);
        }
      } catch (e) {}
      return origToBlob.call(this, cb, ...rest);
    };
    defineNative(patchedToBlob, "toBlob", patchedToBlob);
    HTMLCanvasElement.prototype.toBlob = patchedToBlob;
    }
  } catch (e) {}

  // ---- WebGL ------------------------------------------------------------
  // Two independent toggles: metadata spoofing (vendor/renderer) and image
  // noise (readback). Either can be off.
  try {
    const patchGL = (proto) => {
      if (!proto) return;
      if (fp.webgl.spoofMeta) {
        const orig = proto.getParameter;
        const patched = function getParameter(p) {
          if (p === 37445) return fp.webgl.unmaskedVendor; // UNMASKED_VENDOR_WEBGL
          if (p === 37446) return fp.webgl.unmaskedRenderer; // UNMASKED_RENDERER_WEBGL
          if (p === 7936) return fp.webgl.vendor; // VENDOR
          if (p === 7937) return fp.webgl.renderer; // RENDERER
          return orig.call(this, p);
        };
        defineNative(patched, "getParameter", patched);
        proto.getParameter = patched;
      }

      if (fp.noise.flags.webglImage) {
        const origRead = proto.readPixels;
        const rng = makeRng((fp.noise.webgl >>> 0) ^ 0x9e3779b9);
        const patchedRead = function readPixels(x, y, w, h, format, type, pixels) {
          origRead.call(this, x, y, w, h, format, type, pixels);
          if (pixels && pixels.length > 16) {
            for (let k = 0; k < 4; k++) {
              const i = Math.floor(rng() * pixels.length);
              pixels[i] = pixels[i] ^ 1;
            }
          }
        };
        defineNative(patchedRead, "readPixels", patchedRead);
        proto.readPixels = patchedRead;
      }
    };
    patchGL(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
    patchGL(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
  } catch (e) {}

  // ---- AudioContext noise ------------------------------------------------
  try {
    if (fp.noise.flags.audio) {
    const rng = makeRng((fp.noise.canvasSeed >>> 0) ^ 0x1234abcd);
    const amp = fp.noise.audio;
    const patchFloat = (proto, method) => {
      if (!proto || !proto[method]) return;
      const orig = proto[method];
      const patched = function (array) {
        orig.call(this, array);
        for (let i = 0; i < array.length; i += 100) {
          array[i] = array[i] + (rng() - 0.5) * amp;
        }
      };
      defineNative(patched, method, patched);
      proto[method] = patched;
    };
    patchFloat(window.AnalyserNode && window.AnalyserNode.prototype, "getFloatFrequencyData");
    patchFloat(window.AnalyserNode && window.AnalyserNode.prototype, "getFloatTimeDomainData");

    if (window.AudioBuffer) {
      const orig = AudioBuffer.prototype.getChannelData;
      const patched = function getChannelData(ch) {
        const data = orig.call(this, ch);
        for (let i = 0; i < data.length; i += 500) {
          data[i] = data[i] + (rng() - 0.5) * amp;
        }
        return data;
      };
      defineNative(patched, "getChannelData", patched);
      AudioBuffer.prototype.getChannelData = patched;
    }
    }
  } catch (e) {}

  // ---- ClientRects noise -------------------------------------------------
  // Sub-pixel deterministic jitter on layout rects so getClientRects-based
  // fingerprints differ per profile but layout stays visually identical.
  try {
    if (fp.noise.flags.clientRects) {
      const rng = makeRng((fp.noise.clientRects >>> 0) ^ 0x5bd1e995);
      const jit = () => (rng() - 0.5) * 0.0002;
      const nudge = (r) => {
        if (!r) return r;
        const dx = jit();
        const dy = jit();
        try {
          Object.defineProperties(r, {
            x: { value: r.x + dx, configurable: true },
            y: { value: r.y + dy, configurable: true },
            left: { value: r.left + dx, configurable: true },
            top: { value: r.top + dy, configurable: true },
            right: { value: r.right + dx, configurable: true },
            bottom: { value: r.bottom + dy, configurable: true },
          });
        } catch (e) {}
        return r;
      };
      const wrap = (proto, name, list) => {
        if (!proto || !proto[name]) return;
        const orig = proto[name];
        const patched = function () {
          const res = orig.apply(this, arguments);
          if (list) { for (const r of res) nudge(r); }
          else nudge(res);
          return res;
        };
        defineNative(patched, name, patched);
        proto[name] = patched;
      };
      wrap(window.Element && Element.prototype, "getBoundingClientRect", false);
      wrap(window.Element && Element.prototype, "getClientRects", true);
      wrap(window.Range && Range.prototype, "getBoundingClientRect", false);
    }
  } catch (e) {}

  // ---- SpeechSynthesis voices -------------------------------------------
  try {
    if (fp.voices && window.speechSynthesis) {
      const voiceObjs = fp.voices.map((v) => ({
        name: v.name, lang: v.lang, default: false, localService: true,
        voiceURI: v.name,
      }));
      const getVoices = function getVoices() { return voiceObjs.slice(); };
      defineNative(getVoices, "getVoices", getVoices);
      try {
        Object.defineProperty(window.speechSynthesis, "getVoices", { value: getVoices, configurable: true });
      } catch (e) {}
    }
  } catch (e) {}

  // ---- mediaDevices.enumerateDevices ------------------------------------
  try {
    if (fp.mediaDevices && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const list = fp.mediaDevices.map((d) => ({
        kind: d.kind, label: d.label || "", deviceId: d.deviceId, groupId: d.groupId,
        toJSON() { return this; },
      }));
      const patched = function enumerateDevices() { return Promise.resolve(list.slice()); };
      defineNative(patched, "enumerateDevices", patched);
      try {
        Object.defineProperty(navigator.mediaDevices, "enumerateDevices", { value: patched, configurable: true });
      } catch (e) {}
    }
  } catch (e) {}

  // ---- WebGPU -----------------------------------------------------------
  try {
    if (fp.webgpu === "disable") {
      try { Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true }); } catch (e) {}
    } else if (fp.webgpu === "webgl" && navigator.gpu && navigator.gpu.requestAdapter) {
      // Keep the WebGPU adapter's reported vendor in step with the WebGL one.
      const origReq = navigator.gpu.requestAdapter.bind(navigator.gpu);
      const patched = async function requestAdapter(opts) {
        const adapter = await origReq(opts);
        if (adapter && adapter.requestAdapterInfo) {
          const origInfo = adapter.requestAdapterInfo.bind(adapter);
          adapter.requestAdapterInfo = async function () {
            const info = await origInfo();
            try {
              return Object.assign(Object.create(Object.getPrototypeOf(info)), info, {
                vendor: (fp.webgl.unmaskedVendor || "").toLowerCase().includes("nvidia") ? "nvidia"
                  : (fp.webgl.unmaskedVendor || "").toLowerCase().includes("apple") ? "apple"
                  : (fp.webgl.unmaskedVendor || "").toLowerCase().includes("amd") ? "amd" : "intel",
              });
            } catch (e) { return info; }
          };
        }
        return adapter;
      };
      defineNative(patched, "requestAdapter", patched);
      try { Object.defineProperty(navigator.gpu, "requestAdapter", { value: patched, configurable: true }); } catch (e) {}
    }
  } catch (e) {}

  // ---- geolocation block -------------------------------------------------
  try {
    if (fp.geolocation && fp.geolocation.block && navigator.geolocation) {
      const deny = (success, error) => {
        if (typeof error === "function") {
          error({ code: 1, message: "User denied Geolocation", PERMISSION_DENIED: 1 });
        }
      };
      const g = navigator.geolocation;
      const getCurrentPosition = function getCurrentPosition(s, e) { deny(s, e); };
      const watchPosition = function watchPosition(s, e) { deny(s, e); return 0; };
      defineNative(getCurrentPosition, "getCurrentPosition", getCurrentPosition);
      defineNative(watchPosition, "watchPosition", watchPosition);
      try {
        Object.defineProperty(g, "getCurrentPosition", { value: getCurrentPosition, configurable: true });
        Object.defineProperty(g, "watchPosition", { value: watchPosition, configurable: true });
      } catch (e) {}
    }
  } catch (e) {}

  // ---- touch (mobile OS) -------------------------------------------------
  try {
    if (fp.maxTouchPoints > 0 && !("ontouchstart" in window)) {
      window.ontouchstart = null;
    }
  } catch (e) {}

  // ---- permissions consistency ------------------------------------------
  // Automated Chrome classically leaks: Notification.permission === 'denied'
  // while permissions.query reports 'prompt'. Align them.
  try {
    if (window.Notification && navigator.permissions && navigator.permissions.query) {
      const origQuery = navigator.permissions.query;
      const patched = function query(desc) {
        if (desc && desc.name === "notifications") {
          return Promise.resolve({
            state: Notification.permission === "default" ? "prompt" : Notification.permission,
            onchange: null,
          });
        }
        return origQuery.call(this, desc);
      };
      defineNative(patched, "query", patched);
      navigator.permissions.query = patched;
    }
  } catch (e) {}

  // ---- window.chrome runtime (Chromium only) ----------------------------
  try {
    if (fp.engineFamily === "chromium") {
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) window.chrome.runtime = {};
      window.chrome.app = window.chrome.app || { isInstalled: false };
      window.chrome.csi = window.chrome.csi || function csi() {};
      window.chrome.loadTimes = window.chrome.loadTimes || function loadTimes() {};
    }
  } catch (e) {}

  // ---- WebRTC IP-leak filtering -----------------------------------------
  // Even with the proxy in place, WebRTC can enumerate host candidates that
  // reveal the real LAN/public IP. Strip local candidates (policy 'proxy') or
  // block all ICE hosting (policy 'disable').
  try {
    if (fp.webrtcPolicy !== "default" && window.RTCPeerConnection) {
      const OrigPC = window.RTCPeerConnection;
      const isLeaky = (cand) => {
        if (!cand) return false;
        const c = cand.candidate || "";
        if (fp.webrtcPolicy === "disable") return true;
        // 'proxy' mode: drop host/srflx candidates exposing raw IPs.
        return /(typ host|typ srflx)/.test(c) && !/\.local/.test(c);
      };
      const Patched = function RTCPeerConnection(config, ...rest) {
        const pc = new OrigPC(config, ...rest);
        const origAdd = pc.addEventListener.bind(pc);
        pc.addEventListener = function (type, listener, ...a) {
          if (type === "icecandidate" && typeof listener === "function") {
            const wrapped = function (ev) {
              if (ev && ev.candidate && isLeaky(ev.candidate)) return;
              return listener.call(this, ev);
            };
            return origAdd(type, wrapped, ...a);
          }
          return origAdd(type, listener, ...a);
        };
        Object.defineProperty(pc, "onicecandidate", {
          set(fn) {
            this.addEventListener("icecandidate", fn);
          },
          get() {
            return null;
          },
          configurable: true,
        });
        return pc;
      };
      Patched.prototype = OrigPC.prototype;
      defineNative(Patched, "RTCPeerConnection", Patched);
      window.RTCPeerConnection = Patched;
      if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Patched;
    }
  } catch (e) {}
}
