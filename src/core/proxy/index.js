// Proxy resolver.
//
// Turns a profile's proxy spec into a Playwright proxy config, spawning a local
// bridge first when the protocol isn't natively understood by Chromium.
//
// Returns { proxy, dispose } where `proxy` is passed straight to Playwright and
// `dispose()` tears down any spawned bridge. Native proxies have a no-op dispose.

import { startShadowsocks } from "./protocols/shadowsocks.js";
import { startV2Ray } from "./protocols/v2ray.js";
import { startSsh } from "./protocols/ssh.js";

const NOOP = () => {};

/**
 * @param {object|null} spec profile.proxy
 * @returns {Promise<{proxy: object|undefined, dispose: () => void}>}
 */
export async function resolveProxy(spec) {
  if (!spec || spec.type === "none" || spec.type === "direct") {
    return { proxy: undefined, dispose: NOOP };
  }

  switch (spec.type) {
    case "http":
    case "https":
    case "socks5":
    case "socks4": {
      // Native. NOTE: Chromium (via Playwright) supports auth for HTTP proxies
      // but NOT for SOCKS. For authenticated SOCKS5 upstreams, front them with
      // one of the bridge protocols instead.
      const scheme = spec.type === "https" ? "https" : spec.type;
      const proxy = { server: `${scheme}://${spec.server}:${spec.port}` };
      if (spec.username) proxy.username = spec.username;
      if (spec.password) proxy.password = spec.password;
      if (spec.bypass) proxy.bypass = spec.bypass;
      if ((spec.type === "socks5" || spec.type === "socks4") && spec.username) {
        console.warn(
          "[proxy] Chromium ignores SOCKS auth; username/password will not be used. " +
            "Use an http proxy or a bridge protocol for authenticated egress."
        );
      }
      return { proxy, dispose: NOOP };
    }

    case "shadowsocks":
    case "ss":
      return startShadowsocks(spec);

    case "vmess":
    case "vless":
    case "trojan":
      return startV2Ray(spec);

    case "ssh":
      return startSsh(spec);

    default:
      throw new Error(`unknown proxy type: ${spec.type}`);
  }
}

export const SUPPORTED_PROXY_TYPES = [
  "none",
  "http",
  "https",
  "socks5",
  "socks4",
  "shadowsocks",
  "vmess",
  "vless",
  "trojan",
  "ssh",
];
