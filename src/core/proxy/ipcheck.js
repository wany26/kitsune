// Proxy checking + IP geolocation.
//
// Both features need the *egress* IP as seen through a proxy, so we drive a
// throwaway headless Chromium with that proxy and read a public IP-geo API.
// The result powers "Check proxy" and every "based on IP" fingerprint setting.

import { chromium } from "playwright";
import { resolveProxy } from "./index.js";

const ENDPOINTS = {
  "ip-api": "http://ip-api.com/json/?fields=status,country,countryCode,city,lat,lon,timezone,query,isp",
  ipwhois: "https://ipwho.is/",
};

function normalize(provider, raw) {
  if (provider === "ipwhois") {
    return {
      ip: raw.ip,
      country: raw.country,
      countryCode: raw.country_code,
      city: raw.city,
      lat: raw.latitude,
      lon: raw.longitude,
      timezone: raw.timezone?.id || raw.timezone,
      isp: raw.connection?.isp,
    };
  }
  return {
    ip: raw.query,
    country: raw.country,
    countryCode: raw.countryCode,
    city: raw.city,
    lat: raw.lat,
    lon: raw.lon,
    timezone: raw.timezone,
    isp: raw.isp,
  };
}

/**
 * Look up the egress IP + geo through a resolved Playwright proxy config
 * (or directly when proxy is undefined). Returns a normalized object or null.
 */
export async function ipLookup(proxy, provider = "ip-api") {
  const url = ENDPOINTS[provider] || ENDPOINTS["ip-api"];
  let browser;
  try {
    browser = await chromium.launch({ headless: true, proxy });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const text = await page.evaluate(() => document.body.innerText);
    const raw = JSON.parse(text);
    if (provider === "ip-api" && raw.status && raw.status !== "success") return null;
    return normalize(provider, raw);
  } catch (e) {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Test a proxy spec end-to-end: spin up its bridge (if any), measure latency,
 * and report the egress IP + geo.
 * @returns {{ok:boolean, ms?:number, error?:string, ...geo}}
 */
export async function checkProxy(spec, provider = "ip-api") {
  let dispose = () => {};
  const started = Date.now();
  try {
    const resolved = await resolveProxy(spec);
    dispose = resolved.dispose;
    const geo = await ipLookup(resolved.proxy, provider);
    if (!geo) return { ok: false, error: "no response through proxy" };
    return { ok: true, ms: Date.now() - started, ...geo };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    dispose();
  }
}
