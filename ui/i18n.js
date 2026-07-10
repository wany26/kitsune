// UI internationalization (English / 中文). Loaded before transport-web.js and
// renderer.js so both can call window.KitsuneI18n.t(...). Static markup is
// declared once in index.html via data-i18n[-placeholder|-title] attributes;
// dynamic text generated in renderer.js calls t(key, vars) directly.

(function () {
  const STORAGE_KEY = "kitsune-lang";

  const DICT = {
    en: {
      "topbar.kernels": "Kernels",
      "topbar.kernels.title": "Manage browser & protocol kernels",
      "topbar.dataDir": "Data dir",
      "topbar.dataDir.title": "Open profiles data directory",
      "topbar.newProfile": "+ New profile",
      "topbar.langToggle.title": "Switch interface language",

      "sidebar.profiles": "Profiles",

      "detail.launch": "Launch",
      "detail.stop": "Stop",
      "detail.identity": "Identity",
      "detail.proxy": "Proxy",
      "detail.fullFingerprint": "Full fingerprint (JSON)",
      "detail.edit": "Edit",
      "detail.deleteProfile": "Delete profile",

      "kv.engine": "Engine",
      "kv.os": "OS",
      "kv.preset": "Preset",
      "kv.platform": "Platform",
      "kv.cpuRam": "CPU / RAM",
      "kv.screen": "Screen",
      "kv.timezone": "Timezone",
      "kv.languages": "Languages",
      "kv.gpu": "GPU",
      "kv.type": "Type",
      "kv.server": "Server",
      "kv.host": "Host",
      "kv.user": "User",
      "kv.method": "Method",
      "kv.transport": "Transport",
      "kv.secret": "Secret",
      "kv.directConnection": "direct connection",
      "unit.cores": "cores",
      "common.unknown": "unknown",

      "list.auto": "auto",
      "list.direct": "direct",

      "status.running": "running",
      "status.stopped": "stopped",

      "form.newProfile": "New profile",
      "form.editProfile": "Edit {name}",

      "form.tab.basic": "Basic",
      "form.tab.proxy": "Proxy",
      "form.tab.accounts": "Accounts",
      "form.tab.fp": "Fingerprint",
      "form.tab.adv": "Advanced",

      "form.basic.name": "Name",
      "form.basic.name.placeholder": "e.g. us-account-1",
      "form.basic.engine": "Browser kernel",
      "form.basic.os": "Operating system",
      "form.basic.preset": "Device preset",
      "form.basic.preset.auto": "auto (from OS)",
      "form.basic.ua": "User-Agent",
      "form.basic.ua.auto": "Auto (from kernel + OS)",
      "form.basic.ua.custom": "Custom",
      "form.basic.cookies": "Cookies (JSON array)",
      "form.basic.note": "Note",

      "form.proxy.protocol": "Proxy protocol",
      "form.proxy.ipQuery": "IP query channel",
      "form.proxy.check": "Check proxy",
      "form.proxy.checking": "Checking… (launches a headless browser through the proxy)",
      "form.proxy.failed": "Failed: {error}",
      "form.proxy.error": "Error: {error}",
      "form.proxy.resultOk": "<b>OK</b> · {ms} ms<br>IP {ip} · {city} {country} ({cc})<br>tz {timezone}{isp}",

      "form.accounts.startupTabs": "Startup tabs (opened on launch)",
      "form.accounts.addTab": "+ Add tab URL",
      "form.accounts.accounts": "Accounts",
      "form.accounts.addAccount": "+ Add account",
      "form.accounts.platformPlaceholder": "platform (e.g. apple)",
      "form.accounts.labelPlaceholder": "label / username",

      "form.fp.webrtc": "WebRTC",
      "form.fp.webrtc.forward": "Forward",
      "form.fp.webrtc.replace": "Replace",
      "form.fp.webrtc.real": "Real",
      "form.fp.webrtc.disable": "Disable",
      "form.fp.webrtc.proxy": "Proxy UDP",

      "form.fp.timezone": "Timezone",
      "form.fp.language": "Language",
      "form.fp.mode.ip": "Based on IP",
      "form.fp.mode.real": "Real",
      "form.fp.mode.custom": "Custom",

      "form.fp.uiLanguage": "UI language",
      "form.fp.uilang.language": "Based on language",

      "form.fp.geolocation": "Geolocation",
      "form.fp.geo.block": "Block",
      "form.fp.geoPerm.ask": "Ask each time",
      "form.fp.geoPerm.allow": "Always allow",
      "form.fp.latitude": "Latitude",
      "form.fp.longitude": "Longitude",

      "form.fp.resolution": "Resolution",
      "form.fp.res.ua": "Predefined (from UA)",
      "form.fp.res.custom": "Custom",
      "form.fp.wh": "W × H",

      "form.fp.fonts": "Fonts",
      "form.fp.fonts.default": "Default (OS set)",

      "form.fp.hardwareNoise": "Hardware noise",
      "form.fp.noise.canvas": "Canvas",
      "form.fp.noise.webglImage": "WebGL image",
      "form.fp.noise.audio": "AudioContext",
      "form.fp.noise.mediaDevices": "Media devices",
      "form.fp.noise.clientRects": "ClientRects",
      "form.fp.noise.speechVoices": "SpeechVoices",

      "form.fp.webglMeta": "WebGL metadata",
      "form.fp.webglMeta.custom": "Custom",
      "form.fp.webglMeta.real": "Real",
      "form.fp.vendor": "Vendor",
      "form.fp.renderer": "Renderer",

      "form.fp.webgpu": "WebGPU",
      "form.fp.webgpu.webgl": "Based on WebGL",
      "form.fp.webgpu.real": "Real",
      "form.fp.webgpu.disable": "Disable",

      "form.fp.randomFingerprint": "Random fingerprint",
      "form.fp.randomFingerprint.label": "New random fingerprint each launch",

      "form.adv.seed": "Seed (determines the fingerprint)",
      "form.adv.regenerate": "Regenerate",
      "form.adv.seedHelp": "The seed is fixed per profile so the fingerprint stays identical across relaunches. Regenerate to roll a brand-new (but still stable) identity.",
      "form.adv.seedUnset": "(assigned on save)",

      "form.save": "Save",
      "form.cancel": "Cancel",
      "form.error.nameRequired": "name is required",
      "form.error.cookiesArray": "cookies must be a JSON array",

      "kernels.title": "Kernels",
      "kernels.close": "Close",
      "kernels.browserEngines": "Browser engines",
      "kernels.proxyKernels": "Proxy protocol kernels",
      "kernels.download": "Download",
      "kernels.install": "Install",
      "kernels.installManagedCopy": "Install managed copy",
      "kernels.installing": "Installing…",
      "kernels.installingLog": "installing {name}…\n",
      "kernels.done": "done.\n",
      "kernels.errorLog": "ERROR: {error}\n",
      "kernels.systemBrowserNotFound": "system browser not found",
      "kernels.notDownloaded": "not downloaded",
      "kernels.notFound": "not found",
      "kernels.notInstalled": "not installed",
      "kernels.source.system": "system",
      "kernels.source.managed": "managed",
      "kernels.source.path": "on PATH",
      "kernels.source.playwright": "Playwright",

      "empty.message": "Select a profile, or create a new one.",

      "js.launching": "Launching…",
      "js.launchFailed": "Launch failed:\n{error}",
      "js.deleteConfirm": "Delete \"{name}\" and all its browser data?",
      "js.dataDirAlert": "Profiles are stored on the server at:\n{home}",

      "proxyField.server": "server",
      "proxyField.port": "port",
      "proxyField.username": "username",
      "proxyField.password": "password",
      "proxyField.method": "method",
      "proxyField.id": "id",
      "proxyField.network": "network",
      "proxyField.path": "path",
      "proxyField.host": "host",
      "proxyField.sni": "sni",
      "proxyField.tls": "tls",
      "proxyField.flow": "flow",
      "proxyField.alterId": "alterId",
      "proxyField.user": "user",
      "proxyField.identityFile": "identity file",
    },

    zh: {
      "topbar.kernels": "内核",
      "topbar.kernels.title": "管理浏览器与协议内核",
      "topbar.dataDir": "数据目录",
      "topbar.dataDir.title": "打开配置数据目录",
      "topbar.newProfile": "+ 新建配置",
      "topbar.langToggle.title": "切换界面语言",

      "sidebar.profiles": "配置列表",

      "detail.launch": "启动",
      "detail.stop": "停止",
      "detail.identity": "身份信息",
      "detail.proxy": "代理",
      "detail.fullFingerprint": "完整指纹 (JSON)",
      "detail.edit": "编辑",
      "detail.deleteProfile": "删除配置",

      "kv.engine": "内核",
      "kv.os": "操作系统",
      "kv.preset": "预设",
      "kv.platform": "平台",
      "kv.cpuRam": "CPU / 内存",
      "kv.screen": "屏幕",
      "kv.timezone": "时区",
      "kv.languages": "语言",
      "kv.gpu": "GPU",
      "kv.type": "类型",
      "kv.server": "服务器",
      "kv.host": "主机",
      "kv.user": "用户",
      "kv.method": "加密方式",
      "kv.transport": "传输方式",
      "kv.secret": "密钥",
      "kv.directConnection": "直连",
      "unit.cores": "核",
      "common.unknown": "未知",

      "list.auto": "自动",
      "list.direct": "直连",

      "status.running": "运行中",
      "status.stopped": "已停止",

      "form.newProfile": "新建配置",
      "form.editProfile": "编辑 {name}",

      "form.tab.basic": "基础设置",
      "form.tab.proxy": "代理信息",
      "form.tab.accounts": "账号平台",
      "form.tab.fp": "指纹配置",
      "form.tab.adv": "高级设置",

      "form.basic.name": "名称",
      "form.basic.name.placeholder": "例如 us-account-1",
      "form.basic.engine": "浏览器内核",
      "form.basic.os": "操作系统",
      "form.basic.preset": "设备预设",
      "form.basic.preset.auto": "自动(根据操作系统)",
      "form.basic.ua": "User-Agent",
      "form.basic.ua.auto": "自动(根据内核 + 操作系统)",
      "form.basic.ua.custom": "自定义",
      "form.basic.cookies": "Cookie(JSON 数组)",
      "form.basic.note": "备注",

      "form.proxy.protocol": "代理方式",
      "form.proxy.ipQuery": "IP查询渠道",
      "form.proxy.check": "检查代理",
      "form.proxy.checking": "检测中…(将通过该代理启动一个无头浏览器)",
      "form.proxy.failed": "失败：{error}",
      "form.proxy.error": "错误：{error}",
      "form.proxy.resultOk": "<b>成功</b> · {ms} ms<br>IP {ip} · {city} {country} ({cc})<br>时区 {timezone}{isp}",

      "form.accounts.startupTabs": "标签页(启动时打开)",
      "form.accounts.addTab": "+ 添加标签页",
      "form.accounts.accounts": "账号平台",
      "form.accounts.addAccount": "+ 添加账号",
      "form.accounts.platformPlaceholder": "平台(例如 apple)",
      "form.accounts.labelPlaceholder": "标签 / 用户名",

      "form.fp.webrtc": "WebRTC",
      "form.fp.webrtc.forward": "转发",
      "form.fp.webrtc.replace": "替换",
      "form.fp.webrtc.real": "真实",
      "form.fp.webrtc.disable": "禁用",
      "form.fp.webrtc.proxy": "代理UDP",

      "form.fp.timezone": "时区",
      "form.fp.language": "语言",
      "form.fp.mode.ip": "基于 IP",
      "form.fp.mode.real": "真实",
      "form.fp.mode.custom": "自定义",

      "form.fp.uiLanguage": "界面语言",
      "form.fp.uilang.language": "基于语言",

      "form.fp.geolocation": "地理位置",
      "form.fp.geo.block": "禁止",
      "form.fp.geoPerm.ask": "每次询问",
      "form.fp.geoPerm.allow": "始终允许",
      "form.fp.latitude": "纬度",
      "form.fp.longitude": "经度",

      "form.fp.resolution": "分辨率",
      "form.fp.res.ua": "预定义(根据 UA)",
      "form.fp.res.custom": "自定义",
      "form.fp.wh": "宽 × 高",

      "form.fp.fonts": "字体",
      "form.fp.fonts.default": "默认(系统字体集)",

      "form.fp.hardwareNoise": "硬件噪音",
      "form.fp.noise.canvas": "Canvas",
      "form.fp.noise.webglImage": "WebGL图像",
      "form.fp.noise.audio": "AudioContext",
      "form.fp.noise.mediaDevices": "媒体设备",
      "form.fp.noise.clientRects": "ClientRects",
      "form.fp.noise.speechVoices": "SpeechVoices",

      "form.fp.webglMeta": "WebGL元数据",
      "form.fp.webglMeta.custom": "自定义",
      "form.fp.webglMeta.real": "真实",
      "form.fp.vendor": "厂商",
      "form.fp.renderer": "渲染器",

      "form.fp.webgpu": "WebGPU",
      "form.fp.webgpu.webgl": "基于 WebGL",
      "form.fp.webgpu.real": "真实",
      "form.fp.webgpu.disable": "禁用",

      "form.fp.randomFingerprint": "随机指纹",
      "form.fp.randomFingerprint.label": "开启后，每次启动将忽略部分已有设置，随机生成新指纹",

      "form.adv.seed": "种子(决定指纹内容)",
      "form.adv.regenerate": "重新生成",
      "form.adv.seedHelp": "每个配置的种子是固定的，因此每次启动生成的指纹保持一致。点击「重新生成」可以获得一个全新但同样稳定的身份。",
      "form.adv.seedUnset": "(保存时分配)",

      "form.save": "保存",
      "form.cancel": "取消",
      "form.error.nameRequired": "请填写名称",
      "form.error.cookiesArray": "cookies 必须是 JSON 数组",

      "kernels.title": "内核管理",
      "kernels.close": "关闭",
      "kernels.browserEngines": "浏览器内核",
      "kernels.proxyKernels": "代理协议内核",
      "kernels.download": "下载",
      "kernels.install": "安装",
      "kernels.installManagedCopy": "安装托管副本",
      "kernels.installing": "安装中…",
      "kernels.installingLog": "正在安装 {name}…\n",
      "kernels.done": "完成。\n",
      "kernels.errorLog": "错误：{error}\n",
      "kernels.systemBrowserNotFound": "未检测到系统浏览器",
      "kernels.notDownloaded": "未下载",
      "kernels.notFound": "未找到",
      "kernels.notInstalled": "未安装",
      "kernels.source.system": "系统",
      "kernels.source.managed": "已托管",
      "kernels.source.path": "PATH 中",
      "kernels.source.playwright": "Playwright",

      "empty.message": "请选择一个配置，或新建一个。",

      "js.launching": "启动中…",
      "js.launchFailed": "启动失败：\n{error}",
      "js.deleteConfirm": "删除配置 \"{name}\" 及其全部浏览器数据？",
      "js.dataDirAlert": "配置数据存储在服务端：\n{home}",

      "proxyField.server": "服务器",
      "proxyField.port": "端口",
      "proxyField.username": "用户名",
      "proxyField.password": "密码",
      "proxyField.method": "加密方式",
      "proxyField.id": "ID",
      "proxyField.network": "传输方式",
      "proxyField.path": "路径",
      "proxyField.host": "主机",
      "proxyField.sni": "SNI",
      "proxyField.tls": "TLS",
      "proxyField.flow": "流控",
      "proxyField.alterId": "额外ID",
      "proxyField.user": "用户名",
      "proxyField.identityFile": "私钥文件",
    },
  };

  function detectDefault() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") return saved;
    } catch (e) {}
    return navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  let lang = detectDefault();
  const listeners = [];

  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) ?? DICT.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]);
    return s;
  }

  function applyStaticI18n(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.getAttribute("data-i18n"))));
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.getAttribute("data-i18n-placeholder"))));
    root.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.getAttribute("data-i18n-title"))));
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }

  function setLang(next) {
    if (next !== "en" && next !== "zh") return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    applyStaticI18n(document);
    listeners.forEach((cb) => cb(lang));
  }

  window.KitsuneI18n = {
    t,
    getLang: () => lang,
    setLang,
    onChange: (cb) => listeners.push(cb),
    applyStaticI18n,
  };

  // Apply immediately so static markup (topbar, form, empty state) is already
  // in the right language before renderer.js's async init() finishes. Safe to
  // call synchronously: this script tag sits at the end of <body>, after all
  // the markup it targets has already been parsed.
  applyStaticI18n(document);
})();
