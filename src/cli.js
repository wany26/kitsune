#!/usr/bin/env node
// Thin CLI over the library in ./index.js. No business logic lives here.

import { Command } from "commander";
import {
  listProfiles,
  getProfile,
  createProfile,
  deleteProfile,
  updateProfile,
  launchProfile,
  generateFingerprint,
  PRESETS,
  listEngines,
  browserStatus,
  installBrowser,
  protocolStatus,
  installProtocol,
  checkProxy,
} from "./index.js";
import { startServer } from "./web/server.js";

const program = new Command();
program.name("kitsune").description("Kitsune (狐) — a lightweight, many-faced fingerprint browser").version("0.1.0");

// Parse a proxy from a URL string, or JSON via --proxy-json. Returns a spec.
function parseProxyUrl(url) {
  // ss://method:password@host:port  and  ssh://user@host:port supported inline.
  const m = url.match(/^(\w+):\/\/(?:([^@]+)@)?([^:/?#]+)(?::(\d+))?/);
  if (!m) throw new Error(`cannot parse proxy url: ${url}`);
  const [, scheme, creds, host, port] = m;
  const s = { server: host, port: port ? Number(port) : undefined };

  switch (scheme) {
    case "http":
    case "https":
    case "socks5":
    case "socks4": {
      s.type = scheme;
      if (creds) {
        const [u, p] = creds.split(":");
        s.username = decodeURIComponent(u);
        if (p !== undefined) s.password = decodeURIComponent(p);
      }
      return s;
    }
    case "ss":
    case "shadowsocks": {
      s.type = "shadowsocks";
      if (creds) {
        const [method, password] = creds.split(":");
        s.method = method;
        s.password = decodeURIComponent(password || "");
      }
      return s;
    }
    case "ssh": {
      s.type = "ssh";
      s.host = host;
      s.port = port ? Number(port) : 22;
      if (creds) s.user = decodeURIComponent(creds.split(":")[0]);
      return s;
    }
    default:
      throw new Error(
        `scheme "${scheme}" needs --proxy-json (vmess/vless/trojan use complex/base64 URLs)`
      );
  }
}

function resolveProxySpec(opts) {
  if (opts.proxyJson) return JSON.parse(opts.proxyJson);
  if (opts.proxy) return parseProxyUrl(opts.proxy);
  return { type: "none" };
}

program
  .command("presets")
  .description("List available device presets")
  .action(() => {
    for (const p of PRESETS) {
      console.log(`${p.id.padEnd(20)} ${p.os.padEnd(9)} ${p.webglVendor}`);
    }
  });

program
  .command("engines")
  .description("List available browser kernels")
  .action(() => {
    for (const e of listEngines()) console.log(`${e.id.padEnd(10)} ${e.family.padEnd(9)} ${e.label}`);
  });

program
  .command("kernels")
  .description("Show browser & protocol kernel status")
  .action(async () => {
    const browsers = await browserStatus();
    console.log("Browser kernels:");
    for (const [id, s] of Object.entries(browsers)) {
      const where = s.installed ? `${s.source}${s.version ? " " + s.version : ""} — ${s.path}` : "not found";
      console.log(`  ${id.padEnd(10)} ${(s.installed ? "✓" : "✗")} ${where}`);
    }
    console.log("Protocol kernels:");
    const protos = await protocolStatus();
    for (const [name, s] of Object.entries(protos)) {
      const where = s.installed
        ? `${s.source}${s.version ? " " + s.version : ""} — ${s.path}`
        : s.installable ? "not installed" : "not found";
      console.log(`  ${name.padEnd(12)} ${(s.installed ? "✓" : "✗")} ${where}`);
    }
  });

program
  .command("install-browser <engine>")
  .description("Download a browser kernel (chromium|firefox|webkit|chrome|edge)")
  .action(async (engine) => {
    await installBrowser(engine, (line) => process.stdout.write(line + "\n"));
    console.log(`done: ${engine}`);
  });

program
  .command("install-proxy <name>")
  .description("Download a protocol kernel (xray|shadowsocks)")
  .action(async (name) => {
    const r = await installProtocol(name, (line) => console.log(line));
    console.log(`installed ${name} ${r.version}`);
  });

program
  .command("check-proxy <idOrName>")
  .description("Test a profile's proxy and show the egress IP + geo")
  .action(async (idOrName) => {
    const profile = getProfile(idOrName);
    if (!profile) return console.error(`profile not found: ${idOrName}`);
    console.log("checking proxy (launches a headless browser)…");
    const r = await checkProxy(profile.proxy, profile.ipQuery);
    console.log(JSON.stringify(r, null, 2));
  });

program
  .command("web")
  .description("Start the web UI server")
  .option("-p, --port <port>", "port", "4600")
  .action(async (opts) => {
    const { url } = await startServer({ port: Number(opts.port) });
    console.log(`Fingerprint Browser web UI running at ${url}`);
    console.log("Ctrl-C to stop.");
  });

program
  .command("list")
  .alias("ls")
  .description("List profiles")
  .action(() => {
    const profiles = listProfiles();
    if (!profiles.length) return console.log("(no profiles yet — try `fpb create`)");
    for (const p of profiles) {
      const proxy = p.proxy?.type && p.proxy.type !== "none" ? p.proxy.type : "direct";
      console.log(`${p.id}  ${p.name.padEnd(20)} ${(p.engine || "chromium").padEnd(9)} preset=${p.presetId || "auto"}  proxy=${proxy}`);
    }
  });

program
  .command("create")
  .description("Create a profile")
  .option("-n, --name <name>", "human-readable name")
  .option("-e, --engine <id>", "browser kernel (see `fpb engines`)", "chromium")
  .option("-o, --os <os>", "operating system (Windows|macOS|Linux|Android|iOS)")
  .option("-p, --preset <id>", "device preset (see `fpb presets`)")
  .option("--seed <seed>", "explicit seed (else random, kept stable forever)")
  .option("--proxy <url>", "proxy url, e.g. socks5://host:1080 or ssh://user@host:22")
  .option("--proxy-json <json>", "full proxy spec as JSON (for vmess/vless/trojan)")
  .action((opts) => {
    const profile = createProfile({
      name: opts.name,
      engine: opts.engine,
      os: opts.os,
      presetId: opts.preset,
      seed: opts.seed,
      proxy: resolveProxySpec(opts),
    });
    console.log(`created profile ${profile.id} (${profile.name}) [${profile.engine}]`);
  });

program
  .command("proxy <idOrName>")
  .description("Set/replace a profile's proxy")
  .option("--proxy <url>", "proxy url")
  .option("--proxy-json <json>", "full proxy spec as JSON")
  .action((idOrName, opts) => {
    const spec = resolveProxySpec(opts);
    updateProfile(idOrName, { proxy: spec });
    console.log(`updated proxy for ${idOrName}: ${spec.type}`);
  });

program
  .command("fingerprint <idOrName>")
  .alias("fp")
  .description("Print the fingerprint a profile will use")
  .action((idOrName) => {
    const profile = getProfile(idOrName);
    if (!profile) return console.error(`profile not found: ${idOrName}`);
    const fp = generateFingerprint({
      seed: profile.seed,
      engine: profile.engine,
      os: profile.os,
      presetId: profile.presetId || undefined,
      uaOverride: profile.uaOverride || undefined,
      config: profile.config,
      overrides: profile.overrides,
    });
    console.log(JSON.stringify(fp, null, 2));
  });

program
  .command("delete <idOrName>")
  .alias("rm")
  .description("Delete a profile and its browser data")
  .action((idOrName) => {
    console.log(deleteProfile(idOrName) ? `deleted ${idOrName}` : `not found: ${idOrName}`);
  });

program
  .command("launch <idOrName>")
  .alias("run")
  .description("Launch a profile's browser")
  .option("-u, --url <url>", "initial url", "https://abrahamjuliot.github.io/creepjs/")
  .option("--headless", "run headless", false)
  .action(async (idOrName, opts) => {
    const profile = getProfile(idOrName);
    if (!profile) return console.error(`profile not found: ${idOrName}`);
    console.log(`launching ${profile.name} ...`);
    const { fingerprint, context } = await launchProfile(profile, {
      url: opts.url,
      headless: opts.headless,
    });
    console.log(`  os=${fingerprint.os} preset=${fingerprint.presetId}`);
    console.log(`  ua=${fingerprint.userAgent}`);
    console.log(`  proxy=${profile.proxy?.type || "none"}  tz=${fingerprint.timezone}`);
    console.log("browser is open. Ctrl-C to quit.");
    context.on("close", () => process.exit(0));
  });

program.parseAsync().catch((err) => {
  console.error("error:", err.message);
  process.exit(1);
});
