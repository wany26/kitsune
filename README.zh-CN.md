# 🦊 Kitsune -- 轻量化指纹浏览器

[English](README.md) | 简体中文

> *千面之狐* —— 一个内核，无数个自洽的身份。

一个轻量级、可脚本化的**指纹浏览器**：管理任意多个浏览器配置（profile），每个配置都有一套稳定、内部自洽的反检测指纹，并可各自走独立的代理——包括自定义代理协议。

一个**核心库**（`src/index.js`）驱动三种可互换的前端：一个轻量 **CLI**、一个 **Electron** 桌面应用、以及一个 **Web UI**——三者之间不重复任何逻辑。

## 功能一览

- **多种浏览器内核** —— Chromium、Google Chrome、Microsoft Edge、Firefox（Gecko）、WebKit（Safari）。指纹会按内核自适应：仅 Chromium 才有的特征（Client Hints、`window.chrome`、`userAgentData`）只在 Chromium 上启用；Firefox 则会得到 Gecko 形态的 `oscpu`/`buildID`，且不带 `userAgentData`——每个配置在它实际运行的内核上都是自洽的。
- **逐配置指纹**，由种子（seed）确定性派生——同一配置多次启动完全一致，不同配置各不相同。设备信息成套连贯（操作系统 ↔ UA ↔ 平台 ↔ GPU ↔ 屏幕 ↔ 字体），不会自相矛盾。
- **反检测注入**，在任何页面脚本执行前完成：navigator/userAgentData、Canvas 与 WebGL 噪声、AudioContext 噪声、字体集、插件列表、移除 `navigator.webdriver`、权限一致性、`window.chrome`、WebRTC IP 泄露过滤。所有被修改过的函数 `toString()` 后仍显示为 `[native code]`。
- **CDP 请求头覆盖**：User-Agent、高熵 Client Hints、时区，均与 JS 层保持同步（Chromium 系）。
- **自定义代理协议**：原生 HTTP/SOCKS5（支持 HTTP 认证），以及 Shadowsocks、VMess、VLESS、Trojan、SSH 隧道——通过自动拉起的本地网桥，向浏览器暴露一个 SOCKS5 端口。
- **内核自动拉取**：按需下载浏览器内核（通过 Playwright）和协议二进制（xray、shadowsocks-rust——从各自官方 GitHub Releases 获取），可在 CLI、GUI 或 Web UI 里操作。
- **完整的配置编辑器**（5 个标签页）：操作系统（含 Android/iOS）、UA 覆盖、Cookie 注入、启动标签页、WebRTC 模式、时区 / 语言 / 界面语言 / 地理位置（均可选*基于 IP · 真实 · 自定义*）、分辨率、字体、逐项硬件噪音开关（Canvas · WebGL · Audio · MediaDevices · ClientRects · SpeechVoices）、WebGL 厂商/渲染器、WebGPU、随机指纹开关。详见下方**配置编辑器**一节。
- **代理检测 + 归属地**：通过一次真实的无头请求测试任意代理，读取出口 IP、城市/国家、时区、ISP；启动时所有"基于 IP"的设置都用同一套查询。
- **持久化会话**：每个配置都有独立的用户数据目录，登录状态在重启后依然保留。

## 安装

```bash
npm install          # 会通过 playwright 一并下载 Chromium 内核
```

其余浏览器内核和协议二进制都是按需拉取的（见下方**内核管理**）——一开始不需要在 PATH 里预装任何东西。

## 打包成桌面应用（.app / .dmg）

Logo（项目根目录的 `logo.png`，狐狸图标）是所有图标的唯一来源；Electron GUI 用 [electron-builder](https://www.electron.build/) 打包。

```bash
npm run icon    # logo.png -> build/icon.icns + build/icon.png（App 图标，合成到深藏青品牌背景上）
                # + ui/logo.png + ui/icon.png（透明背景，供界面内顶栏 logo / 空状态 / favicon 使用）
npm run pack    # 未打包的应用 -> dist/mac-arm64/Kitsune.app
npm run dist    # 安装包        -> dist/Kitsune-<版本>-<架构>.dmg（mac；win/linux 上是 nsis/AppImage）
```

打包配置在 `electron-builder.json` 里；Electron 的入口点是 `package.json` 的 `"main": "electron/main.js"`（核心库本身依然可以通过 `exports` 字段被 `import`）。如果 `npm run` 里的脚本缺失，可以直接执行：
`node scripts/make-icon.mjs && npx electron-builder`。

Playwright 会从 asar 里解包出来，这样打包后的应用才能驱动各个浏览器内核。有一点需要注意：打包后的应用复用的是 Playwright 的**全局浏览器缓存**（`~/Library/Caches/ms-playwright`），所以在一台全新的机器上，启动某个配置之前需要先执行一次 `npx playwright install chromium`（或者用应用内的"内核"标签页）。构建产物未签名——首次打开时需要右键 → 打开。

## 内核管理（检测 + 自动拉取）

```bash
node src/cli.js kernels                     # 检测机器上已有的每一种浏览器/协议内核
node src/cli.js install-browser firefox     # 或者: chromium | webkit | chrome | edge
node src/cli.js install-proxy xray          # 或者: shadowsocks
```

`kernels` 命令会**检测机器上已经装好的内核**，避免重复下载——并报告每一个的解析路径和版本号：

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

- **浏览器内核** —— 受管内核（`chromium`/`firefox`/`webkit`）解析到 Playwright 自己的构建版本；系统渠道内核（`chrome`/`edge`）则是从操作系统已知的安装位置里检测出来的。只有受管内核可以自动下载（通过 Playwright 自带的、经过校验的安装器）；系统渠道浏览器需要你自己安装。
- **协议内核** —— 优先从 `~/.kitsune/bin` 检测，然后再看 PATH 上有没有任何已知的可执行文件名（`xray` **或** `v2ray`；`sslocal` **或** libev 版的 `ss-local`；系统自带的 `ssh`）。`xray`/`shadowsocks` 可以从各自官方 GitHub Releases 自动拉取，按你的系统+CPU 架构匹配；代理网桥会优先用受管副本，找不到再退回 PATH 上检测到的版本。

## CLI

```bash
# 设备预设与浏览器内核
node src/cli.js presets
node src/cli.js engines

# 创建一个配置（随机但稳定的种子，chromium 内核，自动预设，直连）
node src/cli.js create --name work1

# 指定浏览器内核和预设
node src/cli.js create --name safari1 --engine webkit
node src/cli.js create --name us-1 --engine chrome --preset win-nvidia --proxy socks5://127.0.0.1:1080

# 自定义协议（可搭配任意内核）
node src/cli.js create --name ss1  --engine firefox --proxy ss://aes-256-gcm:PASSWORD@host:8388
node src/cli.js create --name ssh1 --proxy ssh://user@host:22
node src/cli.js create --name v1 \
  --proxy-json '{"type":"vmess","server":"h","port":443,"id":"UUID","network":"ws","tls":true,"host":"h","path":"/ray"}'

node src/cli.js list
node src/cli.js fingerprint work1     # 打印这个配置实际会用到的完整指纹
node src/cli.js launch work1          # 默认打开 CreepJS 用于验证
node src/cli.js launch work1 --url https://browserleaks.com/canvas
node src/cli.js delete work1
```

配置数据保存在 `~/.kitsune`（可用 `KITSUNE_HOME` 覆盖）。如果之前存在旧版的 `~/.fingerprint-browser` 目录，首次运行时会自动迁移过来。

## 桌面 GUI（Electron）

一个薄薄的 Electron 外壳包着同一个核心库——它纯粹只是一个*管理器*。启动某个配置时，实际打开的仍然是一个由 Playwright 控制的真实 Chromium 窗口，指纹和代理都已生效；Electron 窗口本身只是控制面板。

```bash
npm run gui
```

- **左侧栏** —— 配置列表，带实时运行状态指示（绿色 = 浏览器已打开）。
- **详情视图** —— 身份信息摘要（操作系统、GPU、屏幕、时区……）、代理摘要、完整指纹 JSON，以及一个带**启动** / **停止**按钮的地址栏。
- **新建 / 编辑** —— 选择设备预设和代理协议；代理表单只会显示该协议实际需要的字段（SS 的加密方式、VMess 的 UUID/传输方式/TLS、SSH 密钥等等）。

GUI 读写的是和 CLI 相同的 `~/.kitsune` 数据，两者可以混用。它只通过一个上下文隔离的 preload 桥（`window.kitsune`）与核心库通信——不会有任何 Node 访问权限泄漏到页面上下文里。

## 界面语言（English / 中文）

GUI（Electron 和 Web，共用同一套前端）是完整双语的。首次运行时会根据系统/浏览器语言自动判断（`zh-*` → 中文，否则英文），之后会记住你的选择，并可通过右上角的切换按钮即时切换——不需要刷新页面，切换过程中表单里已经填写的内容也不会丢失。实现在 `ui/i18n.js` 里（一份扁平的 `{ en: {...}, zh: {...} }` 字典 + 一个 `t(key, vars)` 辅助函数）；静态文案通过 `ui/index.html` 里的 `data-i18n`/`data-i18n-placeholder`/`data-i18n-title` 属性拿到翻译，`ui/renderer.js` 里运行时生成的内容则直接调用 `t()`。

## Web UI

同一套管理界面，通过 HTTP 提供：

```bash
npm run web            # -> http://127.0.0.1:4600   （node src/cli.js web --port 4600）
```

Electron 应用和 Web UI 共用**同一套**前端（`ui/`）。唯一的区别是传输层：在 Electron 里，`window.kitsune` 来自 preload 脚本；在浏览器里，它来自 `ui/transport-web.js`，通过 REST API（`src/web/server.js`）通信。启动的浏览器会开在运行该服务端的那台机器上（无头主机可设置 `KITSUNE_HEADLESS=1`）。

## 配置编辑器

两套界面都提供同一个 5 标签页的编辑器。这里的每一项都会按配置持久化保存（`profile/config.js`），并在启动时真正生效——不是摆设。

| 标签页 | 字段（→ 实际效果） |
|-----|----------------------------------|
| **基础设置** | 名称 · 浏览器内核 · **操作系统**（Windows/macOS/Linux/Android/iOS —— Android 与 iOS 会得到对应的移动端 UA、触屏支持和平台标识）· 设备预设 · **User-Agent**（自动生成或自定义字符串）· **Cookie**（JSON，通过 `context.addCookies` 注入）· 备注 |
| **代理信息** | 协议 + 对应字段 · **IP 查询渠道**（ip-api / ipwho.is）· **检查代理** → 通过该代理发起一次无头请求，报告出口 IP、城市/国家、时区、ISP、延迟 |
| **账号平台** | **启动标签页**（每个 URL 在启动时打开为一个标签）· 账号标签 |
| **指纹配置** | **WebRTC** 转发/替换/真实/禁用/代理UDP · **时区 / 语言 / 界面语言 / 地理位置** 均可选*基于 IP · 真实 · 自定义*（IP 模式通过代理做一次预先查询解析得到）· 地理位置权限（每次询问/始终允许）或直接禁止 · **分辨率**（预定义或自定义宽×高）· **字体**（系统默认字体集或自定义）· **硬件噪音**开关：Canvas · WebGL图像 · AudioContext · 媒体设备 · ClientRects · SpeechVoices · **WebGL元数据**（厂商 + 渲染器，或"真实"）· **WebGPU**（跟随 WebGL / 真实 / 禁用）· **随机指纹**（每次启动生成全新种子） |
| **高级设置** | 种子（可重新生成，得到一个全新但同样稳定的身份） |

"基于 IP" 的实现方式是：在真正创建浏览器上下文之前，先通过已解析好的代理做一次预查询，再把查询到的时区 / 语言 / 地理位置喂给（依然是确定性的）指纹生成器。

## 核心库用法

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

## 代理配置格式参考

```js
{ type: "none" }
{ type: "http",  server, port, username?, password? }   // 支持认证
{ type: "socks5", server, port }                        // Chromium 不支持 SOCKS 认证
{ type: "shadowsocks", server, port, password, method?, bin? }
{ type: "vmess"|"vless", server, port, id, network?, path?, host?, tls?, sni?, alterId? }
{ type: "trojan", server, port, password, network?, tls?, sni? }
{ type: "ssh", host, user, port?, identityFile?, password?, strictHostKey? }
```

> 认证型 SOCKS5：Chromium 不会发送 SOCKS 认证信息。这类上游需要用 HTTP 代理或前面提到的某种网桥协议来接。

## 目录结构

```
src/
├── index.js                     公开的库 API（被 CLI/GUI/web 共用）
├── cli.js                       轻量 CLI
├── web/server.js                http 服务端：REST API + 托管 ui/
└── core/
    ├── fingerprint/
    │   ├── presets.js           自洽的操作系统/UA/GPU/屏幕组合
    │   ├── generator.js         种子 + 内核 -> 指纹（确定性生成）
    │   └── inject.js            页面侧的伪装脚本（按内核区分）
    ├── proxy/
    │   ├── index.js             配置 -> Playwright 代理（+ 网桥）
    │   ├── bridge.js            空闲端口分配 / 就绪检测 / 进程生命周期
    │   └── protocols/           shadowsocks · v2ray · ssh
    ├── kernels/index.js         内核自动拉取（浏览器 + 协议）
    ├── profile/store.js         JSON 存储 + 每配置独立的用户数据目录
    └── browser/
        ├── engines.js           浏览器内核注册表（chromium/ff/webkit…）
        └── launcher.js          持久化上下文 + CDP + 注入
ui/                              共用前端（Electron + web）
├── index.html · styles.css · renderer.js
├── i18n.js                     中英文字典 + t() + 语言切换
└── transport-web.js             非 Electron 环境下，通过 REST 实现 window.kitsune
electron/
├── main.js                      IPC 处理 -> 核心库；会话状态跟踪
└── preload.cjs                  上下文隔离的 window.kitsune 桥接（-> ui/）
```

## 合规使用

Kitsune 是一个隐私与网页测试工具：多账号管理、广告/QA 验证、网页抓取研究，以及保护你自己的浏览身份。请只在你被授权的场景下使用它，并遵守你所访问网站的条款以及适用于你的法律法规。不要用它来实施欺诈、规避你本应遵守的封禁，或从事任何欺骗性/违法活动。作者按**原样**提供本项目，不作任何担保，也不对你的使用方式承担责任。

## 贡献

欢迎提交 Issue 和 Pull Request。改动请保持精简、贴合现有风格，并做端到端验证（代码库里有一套贯穿始终的无头验证模式可以参考）。

## 许可证

[MIT](LICENSE) © WanJihe
