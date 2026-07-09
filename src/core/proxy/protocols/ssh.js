// SSH dynamic-forward bridge: `ssh -N -D 127.0.0.1:<port>` turns any SSH box
// into a SOCKS5 egress. Key-based auth by default; password auth needs sshpass.
//
// spec: {
//   type:'ssh', host, port?, user, identityFile?, password?,
//   strictHostKey?: boolean  // default false -> accept-new
// }

import { getFreePort, spawnBridge } from "../bridge.js";

export async function startSsh(spec) {
  const { host, user, port = 22, identityFile, password, strictHostKey = false } = spec;
  if (!host || !user) throw new Error("ssh proxy requires host and user");

  const localPort = await getFreePort();

  const sshArgs = [
    "-N", // no remote command
    "-D",
    `127.0.0.1:${localPort}`,
    "-p",
    String(port),
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    `StrictHostKeyChecking=${strictHostKey ? "yes" : "accept-new"}`,
  ];
  if (identityFile) sshArgs.push("-i", identityFile);
  sshArgs.push(`${user}@${host}`);

  let command = "ssh";
  let args = sshArgs;
  if (password) {
    // Non-interactive password auth requires sshpass on PATH.
    command = "sshpass";
    args = ["-p", password, "ssh", "-o", "PubkeyAuthentication=no", ...sshArgs];
  }

  const handle = await spawnBridge({ name: "ssh", command, args, port: localPort });
  return { proxy: { server: `socks5://127.0.0.1:${localPort}` }, dispose: handle.dispose };
}
