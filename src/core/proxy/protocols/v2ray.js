// V2Ray/Xray bridge: spawn xray (or v2ray) with a generated config that has a
// local SOCKS5 inbound and a vmess/vless/trojan outbound. Supports the common
// transports (tcp/ws/grpc) and TLS.
//
// spec: {
//   type:'vmess'|'vless'|'trojan',
//   server, port, id|password, alterId?, security?, flow?,
//   network?: 'tcp'|'ws'|'grpc', path?, host?, serviceName?,
//   tls?: boolean, sni?, allowInsecure?, bin?  // bin defaults to 'xray'
// }

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getFreePort, spawnBridge } from "../bridge.js";
import { resolveBinary } from "../../kernels/index.js";

function buildStreamSettings(spec) {
  const network = spec.network || "tcp";
  const stream = { network };

  if (spec.tls) {
    stream.security = "tls";
    stream.tlsSettings = {
      serverName: spec.sni || spec.host || spec.server,
      allowInsecure: !!spec.allowInsecure,
    };
  }
  if (network === "ws") {
    stream.wsSettings = {
      path: spec.path || "/",
      headers: spec.host ? { Host: spec.host } : {},
    };
  } else if (network === "grpc") {
    stream.grpcSettings = { serviceName: spec.serviceName || spec.path || "" };
  }
  return stream;
}

function buildOutbound(spec) {
  const stream = buildStreamSettings(spec);
  if (spec.type === "vmess") {
    return {
      protocol: "vmess",
      settings: {
        vnext: [
          {
            address: spec.server,
            port: Number(spec.port),
            users: [
              {
                id: spec.id,
                alterId: Number(spec.alterId || 0),
                security: spec.security || "auto",
              },
            ],
          },
        ],
      },
      streamSettings: stream,
    };
  }
  if (spec.type === "vless") {
    return {
      protocol: "vless",
      settings: {
        vnext: [
          {
            address: spec.server,
            port: Number(spec.port),
            users: [{ id: spec.id, encryption: "none", flow: spec.flow || "" }],
          },
        ],
      },
      streamSettings: stream,
    };
  }
  if (spec.type === "trojan") {
    return {
      protocol: "trojan",
      settings: {
        servers: [{ address: spec.server, port: Number(spec.port), password: spec.password }],
      },
      streamSettings: stream,
    };
  }
  throw new Error(`unsupported v2ray outbound type: ${spec.type}`);
}

export async function startV2Ray(spec) {
  const bin = spec.bin || resolveBinary("xray");
  if (!spec.server || !spec.port) throw new Error(`${spec.type} proxy requires server and port`);
  if ((spec.type === "vmess" || spec.type === "vless") && !spec.id) {
    throw new Error(`${spec.type} proxy requires id (UUID)`);
  }
  if (spec.type === "trojan" && !spec.password) {
    throw new Error("trojan proxy requires password");
  }

  const localPort = await getFreePort();
  const config = {
    log: { loglevel: "warning" },
    inbounds: [
      {
        listen: "127.0.0.1",
        port: localPort,
        protocol: "socks",
        settings: { udp: true, auth: "noauth" },
      },
    ],
    outbounds: [buildOutbound(spec)],
  };

  const cfgPath = path.join(os.tmpdir(), `kitsune-v2-${localPort}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify(config));

  // xray and v2ray both accept `run -c <config>`.
  const handle = await spawnBridge({
    name: spec.type,
    command: bin,
    args: ["run", "-c", cfgPath],
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
