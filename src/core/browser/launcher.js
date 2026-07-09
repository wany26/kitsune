// Browser launcher: profile -> running browser with the full fingerprint,
// proxy, cookies, startup tabs and IP-derived settings applied.

import crypto from "node:crypto";
import { chromium, firefox, webkit } from "playwright";
import { generateFingerprint } from "../fingerprint/generator.js";
import { fingerprintPageScript } from "../fingerprint/inject.js";
import { resolveProxy } from "../proxy/index.js";
import { ipLookup } from "../proxy/ipcheck.js";
import { userDataDir } from "../profile/store.js";
import { mergeConfig } from "../profile/config.js";
import { getEngine } from "./engines.js";
import { COUNTRY_LOCALE } from "../fingerprint/presets.js";

const BROWSER_TYPES = { chromium, firefox, webkit };

function chromiumArgs(fp) {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=IsolateOrigins,site-per-process,Translate,AcceptCHFrame",
    `--lang=${fp.locale}`,
    "--window-size=1280,800",
  ];
  if (fp.webrtcPolicy === "disable" || fp.webrtcPolicy === "filter") {
    args.push("--force-webrtc-ip-handling-policy=disable_non_proxied_udp");
  }
  return args;
}

function firefoxPrefs(fp) {
  return {
    "intl.accept_languages": fp.languages.join(","),
    "layout.css.devPixelsPerPx": String(fp.screen.devicePixelRatio),
    "media.peerconnection.enabled": fp.webrtcPolicy !== "disable",
    "media.peerconnection.ice.default_address_only": true,
  };
}

async function applyCdpOverrides(page, fp) {
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.setUserAgentOverride", {
      userAgent: fp.userAgent,
      acceptLanguage: fp.languages.join(","),
      platform: fp.platform,
      userAgentMetadata: fp.userAgentMetadata,
    });
  } catch (e) {}
}

// Playwright/Chrome cookie shape from a loosely-typed cookie object.
function normalizeCookies(cookies) {
  const cap = { lax: "Lax", strict: "Strict", none: "None", Lax: "Lax", Strict: "Strict", None: "None" };
  const out = [];
  for (const c of cookies || []) {
    if (!c || !c.name || c.value == null) continue;
    const cookie = { name: c.name, value: String(c.value) };
    if (c.domain) { cookie.domain = c.domain; cookie.path = c.path || "/"; }
    else if (c.url) cookie.url = c.url;
    else continue; // need a target
    if (c.httpOnly != null) cookie.httpOnly = !!c.httpOnly;
    if (c.secure != null) cookie.secure = !!c.secure;
    if (c.sameSite && cap[c.sameSite]) cookie.sameSite = cap[c.sameSite];
    if (!c.session && typeof c.expires === "number" && c.expires > 0) cookie.expires = c.expires;
    out.push(cookie);
  }
  return out;
}

/** Decide whether we need an IP preflight, and perform it through the proxy. */
async function resolveFromIp(cfg, proxy, ipQuery) {
  const needs = cfg.timezone.mode === "ip" || cfg.language.mode === "ip" || cfg.geolocation.mode === "ip";
  if (!needs) return {};
  const geo = await ipLookup(proxy, ipQuery);
  if (!geo) return {};
  const byCountry = COUNTRY_LOCALE[geo.countryCode] || {};
  return {
    timezone: geo.timezone || byCountry.timezone,
    languages: byCountry.languages,
    geolocation: geo.lat != null ? { latitude: geo.lat, longitude: geo.lon, accuracy: 50 } : null,
  };
}

/**
 * Launch a profile.
 * @param {object} profile  a stored (hydrated) profile record
 * @param {object} [opts]   { headless, url }
 */
export async function launchProfile(profile, opts = {}) {
  const cfg = mergeConfig(profile.config || {});
  const eng = getEngine(profile.engine);
  const { proxy, dispose: disposeProxy } = await resolveProxy(profile.proxy);

  // "Random fingerprint": ignore the stored seed and roll a fresh one per launch.
  const seed = cfg.randomize ? crypto.randomBytes(16).toString("hex") : profile.seed;

  const resolved = await resolveFromIp(cfg, proxy, profile.ipQuery);

  const fp = generateFingerprint({
    seed,
    engine: profile.engine,
    os: profile.os,
    presetId: profile.presetId || undefined,
    uaOverride: profile.uaOverride || undefined,
    config: cfg,
    resolved,
    overrides: profile.overrides || {},
  });

  const browserType = BROWSER_TYPES[getEngine(profile.engine).pwType];

  const options = {
    headless: opts.headless ?? false,
    proxy,
    viewport: null,
    userAgent: fp.userAgent,
    locale: fp.locale,
    timezoneId: fp.timezone,
  };

  // Geolocation: set a position unless blocked; grant permission unless "ask".
  if (fp.geolocation.position && !fp.geolocation.block) {
    options.geolocation = fp.geolocation.position;
    if (fp.geolocation.permission !== "ask") options.permissions = ["geolocation"];
  }

  if (eng.channel) options.channel = eng.channel;
  if (eng.family === "chromium") {
    options.ignoreDefaultArgs = ["--enable-automation"];
    options.args = chromiumArgs(fp);
  } else if (eng.family === "firefox") {
    options.firefoxUserPrefs = firefoxPrefs(fp);
  }

  const context = await browserType.launchPersistentContext(userDataDir(profile), options);

  await context.addInitScript(fingerprintPageScript, fp);

  if (eng.cdp) {
    for (const page of context.pages()) await applyCdpOverrides(page, fp);
    context.on("page", (page) => applyCdpOverrides(page, fp));
  }

  // Cookies.
  const cookies = normalizeCookies(profile.cookies);
  if (cookies.length) await context.addCookies(cookies).catch(() => {});

  const dispose = async () => {
    try { await context.close(); } catch (e) {}
    disposeProxy();
  };
  context.once("close", disposeProxy);

  // Startup tabs: explicit opts.url wins, else the profile's startupUrls.
  const urls = opts.url ? [opts.url] : profile.startupUrls && profile.startupUrls.length ? profile.startupUrls : [];
  for (let i = 0; i < urls.length; i++) {
    const page = i === 0 ? context.pages()[0] || (await context.newPage()) : await context.newPage();
    await page.goto(urls[i], { waitUntil: "domcontentloaded" }).catch(() => {});
  }

  return { context, fingerprint: fp, dispose };
}
