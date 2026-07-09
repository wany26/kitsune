# 🦊 Kitsune 狐

> *The many-faced fox* — one core, endless coherent identities.

A lightweight, scriptable **fingerprint browser**: manage many browser profiles,
each with a stable, self-consistent anti-detection fingerprint, and route each
through its own proxy — including custom proxy protocols.

One **core library** (`src/index.js`) drives three interchangeable front-ends:
a thin **CLI**, an **Electron** desktop app, and a **web UI** — no logic is
duplicated across them.

## What it does

- **Multiple browser kernels** — Chromium, Google Chrome, Microsoft Edge,
  Firefox (Gecko), and WebKit (Safari). The fingerprint adapts per engine:
  Chromium-only tells (Client Hints, `window.chrome`, `userAgentData`) are used
  only on Chromium, while Firefox gets Gecko-shaped `oscpu`/`buildID` and no
  `userAgentData` — so each profile is coherent *for the engine it runs on*.
- **Per-profile fingerprints** derived deterministically from a seed — identical
  across relaunches, unique across profiles. Coherent device bundles (OS ↔ UA ↔
  platform ↔ GPU ↔ screen ↔ fonts) so nothing contradicts itself.
- **Anti-detection injection** applied before any page script:
  navigator/userAgentData, canvas & WebGL noise, AudioContext noise, font set,
  plugins, `navigator.webdriver` removal, permissions consistency, `window.chrome`,
  and WebRTC IP-leak filtering. Patched functions report `[native code]`.
- **CDP header overrides** for User-Agent + high-entropy Client Hints + timezone,
  kept in sync with the JS surface (Chromium family).
- **Custom proxy protocols**: native HTTP/SOCKS5 (with HTTP auth), plus
  Shadowsocks, VMess, VLESS, Trojan, and SSH tunnels via auto-spawned local
  bridges that expose a SOCKS5 port to the browser.
- **Auto-pull kernels**: download browser engines (via Playwright) and protocol
  binaries (xray, shadowsocks-rust — fetched from their official GitHub releases)
  on demand, from the CLI, GUI, or web UI.
- **Full profile editor** (5 tabs): OS incl. Android/iOS, UA override, cookie
  injection, startup tabs, WebRTC modes, timezone / language / UI-language /
  geolocation as *based-on-IP · real · custom*, resolution, fonts, per-feature
  hardware noise (Canvas · WebGL · Audio · MediaDevices · ClientRects ·
  SpeechVoices), WebGL vendor/renderer, WebGPU, and a random-fingerprint switch.
  See **Profile editor** below.
- **Proxy check + geo**: test any proxy through a real headless request and read
  back the egress IP, city/country, timezone and ISP; the same lookup drives
  every "based on IP" setting at launch.
- **Persistent sessions**: each profile has its own user-data dir, so logins
  survive relaunches.

## Scope / honesty

This is a JS-injection + CDP layer over the stock Playwright engines. It passes
the common detectors (CreepJS, browserleaks, pixelscan, iphey) and is genuinely
lightweight. It does **not** patch a browser's C++ source the way commercial
browsers do — that route is a multi-hour, multi-GB compile and is out of scope.
WebKit profiles are always presented as macOS Safari (Safari ships only on Apple
platforms; a Windows+WebKit combo would be incoherent).

## Install

```bash
npm install          # also downloads the Chromium kernel via playwright
```

Other browser kernels and protocol binaries are pulled on demand (see
**Kernel manager** below) — nothing else needs to be on your PATH up front.

## Kernel manager (detect + auto-pull)

```bash
node src/cli.js kernels                     # detect every browser + protocol kernel
node src/cli.js install-browser firefox     # or: chromium | webkit | chrome | edge
node src/cli.js install-proxy xray          # or: shadowsocks
```

`kernels` **detects what's already on the machine** so you don't re-download
what you have — reporting the resolved path and version for each:

```
Browser kernels:
  chromium   ✓ playwright — …/ms-playwright/chromium-1228/…
  chrome     ✓ system 149.0.7827.201 — /Applications/Google Chrome.app/…
  edge       ✓ system 150.0.4078.50  — /Applications/Microsoft Edge.app/…
  webkit     ✗ not found
Protocol kernels:
  xray         ✓ path 5.49.0 — /opt/homebrew/bin/v2ray      (found via v2ray)
  shadowsocks  ✗ not installed
  ssh          ✓ path OpenSSH_10.2p1 — /usr/bin/ssh
```

- **Browser kernels** — managed engines (`chromium`/`firefox`/`webkit`) resolve
  to the Playwright build; channel engines (`chrome`/`edge`) are detected from
  the OS's known install locations. Only managed engines can be auto-downloaded
  (through Playwright's verified installer); a channel browser must be installed
  by you.
- **Protocol kernels** — detected from `~/.fingerprint-browser/bin` first, then
  from any known binary name on PATH (`xray` **or** `v2ray`; `sslocal` **or**
  libev's `ss-local`; system `ssh`). `xray`/`shadowsocks` can be auto-pulled
  from their official GitHub releases, matched to your OS+CPU; the proxy bridges
  prefer the managed copy and fall back to whatever was detected on PATH.

## CLI

```bash
# device presets and browser kernels
node src/cli.js presets
node src/cli.js engines

# create a profile (random stable seed, chromium, auto preset, direct connection)
node src/cli.js create --name work1

# choose a browser kernel and a preset
node src/cli.js create --name safari1 --engine webkit
node src/cli.js create --name us-1 --engine chrome --preset win-nvidia --proxy socks5://127.0.0.1:1080

# custom protocols (with any engine)
node src/cli.js create --name ss1  --engine firefox --proxy ss://aes-256-gcm:PASSWORD@host:8388
node src/cli.js create --name ssh1 --proxy ssh://user@host:22
node src/cli.js create --name v1 \
  --proxy-json '{"type":"vmess","server":"h","port":443,"id":"UUID","network":"ws","tls":true,"host":"h","path":"/ray"}'

node src/cli.js list
node src/cli.js fingerprint work1     # print the exact fingerprint it will use
node src/cli.js launch work1          # opens CreepJS by default to verify
node src/cli.js launch work1 --url https://browserleaks.com/canvas
node src/cli.js delete work1
```

Profiles live in `~/.fingerprint-browser` (override with `FPB_HOME`).

## Desktop GUI (Electron)

A thin Electron shell wraps the same core library — it's purely a *manager*.
Launching a profile still opens a real Playwright-controlled Chromium window
with the fingerprint + proxy applied; the Electron window is the control panel.

```bash
npm run gui
```

- **Left pane** — profile list with a live running indicator (green = browser open).
- **Detail view** — identity summary (OS, GPU, screen, timezone…), proxy summary,
  full fingerprint JSON, and a URL box with **Launch** / **Stop**.
- **New / Edit** — pick a device preset and a proxy protocol; the proxy form
  shows only the fields that protocol needs (SS method, VMess UUID/transport/TLS,
  SSH key, etc.).

The GUI reads/writes the same `~/.fingerprint-browser` store as the CLI, so you
can mix the two. It talks to the core only through a context-isolated preload
bridge (`window.fpb`) — no Node access leaks into page context.

## Web UI

The same manager UI, served over HTTP:

```bash
npm run web            # -> http://127.0.0.1:4600   (node src/cli.js web --port 4600)
```

The Electron app and the web UI share **one** frontend (`ui/`). The only
difference is the transport: under Electron `window.fpb` comes from the preload;
in the browser it comes from `ui/transport-web.js`, which talks to the REST API
in `src/web/server.js`. Launched browsers open on the machine running the server
(set `FPB_HEADLESS=1` for a headless host).

## Profile editor

Both UIs expose a 5-tab editor. Everything here is stored per profile
(`profile/config.js`) and applied at launch — it is not a mockup.

| Tab | Fields (→ what actually happens) |
|-----|----------------------------------|
| **Basic** | Name · Browser kernel · **OS** (Windows/macOS/Linux/Android/iOS — Android & iOS get a mobile UA + touch + platform) · Device preset · **User-Agent** (auto or custom string) · **Cookies** (JSON → injected via `context.addCookies`) · Note |
| **Proxy** | Protocol + fields · **IP query channel** (ip-api / ipwho.is) · **Check proxy** → launches a headless request through the proxy and reports egress IP, city/country, timezone, ISP, latency |
| **Accounts** | **Startup tabs** (each URL opened as a tab on launch) · account labels |
| **Fingerprint** | **WebRTC** forward/replace/real/disable/proxy · **Timezone / Language / UI-language / Geolocation** each *based-on-IP · real · custom* (IP mode resolved from a preflight lookup through the proxy) · geolocation permission (ask/allow) or block · **Resolution** (UA-predefined or custom W×H) · **Fonts** (OS set or custom) · **Hardware noise** toggles: Canvas · WebGL image · AudioContext · MediaDevices · ClientRects · SpeechVoices · **WebGL metadata** (vendor + renderer, or "real") · **WebGPU** (match WebGL / real / disable) · **Random fingerprint** (fresh seed each launch) |
| **Advanced** | Seed (regenerate for a brand-new but still-stable identity) |

"Based on IP" works by doing a preflight lookup through the resolved proxy
before the real context is created, then feeding the derived timezone / language
/ geolocation into the (still deterministic) fingerprint generator.

## Library

```js
import { createProfile, launchProfile } from "./src/index.js";

const profile = createProfile({
  name: "acct-1",
  engine: "firefox",
  presetId: "mac-apple-silicon",
  proxy: { type: "ssh", host: "1.2.3.4", user: "ubuntu", identityFile: "~/.ssh/id_ed25519" },
});

const { context, fingerprint } = await launchProfile(profile, { url: "https://example.com" });
```

## Proxy spec reference

```js
{ type: "none" }
{ type: "http",  server, port, username?, password? }   // auth supported
{ type: "socks5", server, port }                        // Chromium ignores SOCKS auth
{ type: "shadowsocks", server, port, password, method?, bin? }
{ type: "vmess"|"vless", server, port, id, network?, path?, host?, tls?, sni?, alterId? }
{ type: "trojan", server, port, password, network?, tls?, sni? }
{ type: "ssh", host, user, port?, identityFile?, password?, strictHostKey? }
```

> Authenticated SOCKS5: Chromium doesn't send SOCKS credentials. Front such
> upstreams with an HTTP proxy or one of the bridge protocols.

## Layout

```
src/
├── index.js                     public library API (wrapped by CLI/GUI/web)
├── cli.js                       thin CLI
├── web/server.js                http server: REST API + serves ui/
└── core/
    ├── fingerprint/
    │   ├── presets.js           coherent OS/UA/GPU/screen bundles
    │   ├── generator.js         seed + engine -> fingerprint (deterministic)
    │   └── inject.js            page-side spoofing script (engine-aware)
    ├── proxy/
    │   ├── index.js             spec -> Playwright proxy (+ bridge)
    │   ├── bridge.js            free-port / readiness / process lifecycle
    │   └── protocols/           shadowsocks · v2ray · ssh
    ├── kernels/index.js         auto-pull browser + protocol kernels
    ├── profile/store.js         JSON store + per-profile user-data dirs
    └── browser/
        ├── engines.js           browser-kernel registry (chromium/ff/webkit…)
        └── launcher.js          persistent context + CDP + injection
ui/                              shared frontend (Electron + web)
├── index.html · styles.css · renderer.js
└── transport-web.js             window.fpb over REST when not under Electron
electron/
├── main.js                      IPC handlers -> core library; session tracking
└── preload.cjs                  context-isolated window.fpb bridge (-> ui/)
```

## Responsible use

Kitsune is a privacy and web-testing tool: multi-account management, ad/QA
verification, web-scraping research, and protecting your own browsing identity.
Use it only where you are authorized to, and follow the terms of the sites you
visit and the laws that apply to you. Don't use it for fraud, evading bans you're
subject to, or any deceptive or illegal activity. The authors provide it
**as-is**, with no warranty and no responsibility for how you use it.

## Contributing

Issues and pull requests are welcome. Keep changes surgical, match the existing
style, and verify behavior end-to-end (there's a headless verification pattern
throughout the codebase).

## License

[MIT](LICENSE) © WanJihe
