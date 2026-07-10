// Shadowsocks bridge: spawn `sslocal` (shadowsocks-rust or -libev) exposing a
// local SOCKS5 inbound. Both implementations accept the same JSON config via -c.
//
// spec: { type:'shadowsocks', server, port, password, method, bin? }

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getFreePort, spawnBridge } from "../bridge.js";
import { resolveBinary } from "../../kernels/index.js";

export async function startShadowsocks(spec) {
  const { server, port, password, method = "aes-256-gcm", bin = resolveBinary("sslocal") } = spec;
  if (!server || !port || !password) {
    throw new Error("shadowsocks proxy requires server, port and password");
  }
  const localPort = await getFreePort();

  const config = {
    server,
    server_port: Number(port),
    local_address: "127.0.0.1",
    local_port: localPort,
    password,
    method,
    mode: "tcp_and_udp",
    timeout: 300,
  };

  const cfgPath = path.join(os.tmpdir(), `kitsune-ss-${localPort}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify(config));

  const handle = await spawnBridge({
    name: "shadowsocks",
    command: bin,
    args: ["-c", cfgPath],
    port: localPort,
  });

  const origDispose = handle.dispose;
  handle.dispose = () => {
    origDispose();
    try {
      fs.unlinkSync(cfgPath);
    } catch (e) {}
  };
  return { proxy: { server: `socks5://127.0.0.1:${localPort}` }, dispose: handle.dispose };
}
