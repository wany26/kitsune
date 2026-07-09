// Shared helpers for local proxy bridges.
//
// Chromium only speaks HTTP/SOCKS4/SOCKS5. For every "custom" protocol
// (Shadowsocks, VMess/VLESS/Trojan, SSH) we spawn a local client that listens
// on 127.0.0.1:<port> as a SOCKS5 inbound and forward the browser there.

import net from "node:net";
import { spawn } from "node:child_process";

/** Find an available TCP port on localhost. */
export function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Resolve once something is accepting TCP connections on host:port. */
export function waitForPort(port, host = "127.0.0.1", { timeout = 8000, interval = 150 } = {}) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.connect({ port, host });
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > deadline) reject(new Error(`timeout waiting for ${host}:${port}`));
        else setTimeout(attempt, interval);
      });
    };
    attempt();
  });
}

/**
 * Spawn a bridge process and return a handle once its SOCKS port is live.
 * @returns {Promise<{port:number, proc:import('child_process').ChildProcess, dispose:()=>void}>}
 */
export async function spawnBridge({ command, args, port, env, name }) {
  const proc = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });

  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  proc.on("error", (err) => {
    if (err.code === "ENOENT") {
      err.message = `'${command}' not found on PATH — install it to use ${name} proxies.`;
    }
  });

  const dispose = () => {
    try {
      proc.kill("SIGTERM");
    } catch (e) {}
  };
  process.once("exit", dispose);

  const exited = new Promise((_, reject) =>
    proc.once("exit", (code) =>
      reject(new Error(`${name} bridge exited early (code ${code}). stderr:\n${stderr.slice(-800)}`))
    )
  );

  try {
    await Promise.race([waitForPort(port), exited]);
  } catch (err) {
    dispose();
    throw err;
  }

  return { port, proc, dispose };
}
