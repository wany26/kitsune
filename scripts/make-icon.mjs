// Build every icon artifact from the single master artwork at logo.png
// (project root). Two derived families:
//   - UI copies (ui/logo.png, ui/icon.png): transparent background, trimmed
//     to the artwork's own bounds — these sit directly on the app's dark
//     background, so no backdrop is composited in.
//   - App icon (build/icon.png, build/icon.icns): the same artwork centered
//     on a filled rounded-square backdrop matching the app's navy/blue brand,
//     since macOS does not auto-mask or auto-fill third-party Dock icons —
//     the shape has to be baked into the pixels.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const master = path.join(root, "logo.png");
if (!fs.existsSync(master)) throw new Error("logo.png not found at project root");

const buildDir = path.join(root, "build");
const iconset = path.join(buildDir, "icon.iconset");
fs.mkdirSync(iconset, { recursive: true });

// 1. Trim the transparent margin around the artwork (with a little breathing
//    room) so every derived size frames the fox consistently.
const trimmed = path.join(buildDir, "logo-trimmed.png");
execFileSync("python3", ["-c", `
from PIL import Image
im = Image.open(${JSON.stringify(master)}).convert("RGBA")
bbox = im.split()[-1].getbbox()
l, t, r, b = bbox
pad_x, pad_y = int((r - l) * 0.05), int((b - t) * 0.05)
box = (max(0, l - pad_x), max(0, t - pad_y), min(im.width, r + pad_x), min(im.height, b + pad_y))
im.crop(box).save(${JSON.stringify(trimmed)})
`]);

// 2. UI copies: transparent, resized straight from the trimmed artwork.
execFileSync("sips", ["-Z", "480", trimmed, "--out", path.join(root, "ui/logo.png")], { stdio: "ignore" });
execFileSync("sips", ["-Z", "256", trimmed, "--out", path.join(root, "ui/icon.png")], { stdio: "ignore" });
console.log("wrote ui/logo.png + ui/icon.png (transparent)");

// 3. App icon master: composite the trimmed artwork onto the brand backdrop.
const logoDataUri = `data:image/png;base64,${fs.readFileSync(trimmed).toString("base64")}`;
const html = `<!doctype html><html><body style="margin:0">
<div style="
  width:1024px; height:1024px; border-radius:232px; position:relative;
  overflow:hidden;
  background: linear-gradient(#1b2436, #0c0f15);
">
  <div style="
    position:absolute; inset:0;
    background: radial-gradient(circle at 50% 34%, rgba(79,140,255,0.32), rgba(79,140,255,0.05) 60%, rgba(79,140,255,0) 100%);
  "></div>
  <div style="
    position:absolute; inset:6px; border-radius:226px;
    box-shadow: inset 0 0 0 3px rgba(255,255,255,0.07);
  "></div>
  <img src="${logoDataUri}" style="
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width:900px; height:auto; filter: drop-shadow(0 18px 40px rgba(0,0,0,0.35));
  " />
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
const appIconMaster = path.join(buildDir, "icon.png");
await page.locator("div").first().screenshot({ path: appIconMaster });
await browser.close();
console.log("wrote build/icon.png (app icon master)");

// 4. Assemble .icns for macOS (sips + iconutil). Best-effort: on non-mac hosts
//    this is skipped and electron-builder derives icons from build/icon.png.
try {
  const sizes = [
    [16, "icon_16x16.png"], [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"], [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"], [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"], [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"], [1024, "icon_512x512@2x.png"],
  ];
  for (const [px, name] of sizes) {
    execFileSync("sips", ["-z", String(px), String(px), appIconMaster, "--out", path.join(iconset, name)], { stdio: "ignore" });
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(buildDir, "icon.icns")]);
  console.log("wrote build/icon.icns");
} catch (e) {
  console.warn("skipped icon.icns (sips/iconutil unavailable):", e.message);
}
