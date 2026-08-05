// system-probe lifecycle helpers.
//
// Wraps the bundled `bin/system-probe.zip` (a standalone CWS runtime-security
// binary — no full Datadog Agent install needed): extract it, run it as a
// background daemon, and drive its `runtime activity-dump start`/`stop` CLI to
// capture a host-wide activity dump for the job.
//
// Recipe followed here: bin/system-probe.md.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 20; // ~100s, matches the doc's `seq 1 20` / `sleep 5` loop.

export interface DaemonHandle {
  pid: number | undefined;
  logPath: string;
}

/** Scratch directory for this run's extracted binary, config, and logs. */
export function workDir(): string {
  const base = process.env.RUNNER_TEMP || os.tmpdir();
  return path.join(base, "anomalous-probe");
}

/** Unzip bin/system-probe.zip (shipped alongside the action) and chmod +x it. */
export async function extractBinary(actionDir: string): Promise<string> {
  const dir = workDir();
  const binDir = path.join(dir, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const zipPath = path.join(actionDir, "bin", "system-probe.zip");
  await tc.extractZip(zipPath, binDir);

  // The zip stores the binary under bin/system-probe; flatten if needed.
  let binaryPath = path.join(binDir, "system-probe");
  if (!fs.existsSync(binaryPath)) {
    binaryPath = path.join(binDir, "bin", "system-probe");
  }
  fs.chmodSync(binaryPath, 0o755);
  return binaryPath;
}

/** Write the minimal system-probe.yaml + datadog.yaml pair (doc §2). */
export function writeConfigs(dumpName: string): string {
  const dir = workDir();
  const configDir = path.join(dir, "config");
  fs.mkdirSync(configDir, { recursive: true });

  const sysprobeSocket = path.join(dir, "sysprobe.sock");
  const runtimeSecuritySocket = path.join(dir, "runtime-security.sock");
  const hostname = `anomalous-${dumpName}`;

  fs.writeFileSync(
    path.join(configDir, "system-probe.yaml"),
    [
      "system_probe_config:",
      `  sysprobe_socket: ${sysprobeSocket}`,
      "",
      "runtime_security_config:",
      `  socket: ${runtimeSecuritySocket}`,
      "  enabled: true",
      "  activity_dump:",
      "    enabled: true",
      "",
    ].join("\n"),
  );

  fs.writeFileSync(
    path.join(configDir, "datadog.yaml"),
    [
      'api_key: "00000000000000000000000000000000"',
      `hostname: "${hostname}"`,
      "runtime_security_config:",
      `  socket: ${runtimeSecuritySocket}`,
      "",
    ].join("\n"),
  );

  return configDir;
}

/**
 * Start the system-probe daemon detached, logging to workDir/daemon.log.
 *
 * Uses raw child_process.spawn rather than @actions/exec: exec has no
 * detached/background mode, and this process must keep running after main.ts
 * exits so the job's own steps can proceed.
 */
export function startDaemon(binaryPath: string, configDir: string): DaemonHandle {
  const dir = workDir();
  const logPath = path.join(dir, "daemon.log");
  const logFd = fs.openSync(logPath, "a");

  const child = spawn(
    "sudo",
    [binaryPath, "run", "-c", configDir, "--datadogcfgpath", configDir],
    { detached: true, stdio: ["ignore", logFd, logFd] },
  );
  child.unref();
  fs.closeSync(logFd);

  return { pid: child.pid, logPath };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll `runtime activity-dump list` until the daemon's command socket is ready. */
export async function waitForSocket(
  binaryPath: string,
  configDir: string,
  logPath: string,
): Promise<void> {
  const args = [
    binaryPath,
    "runtime",
    "activity-dump",
    "-c",
    configDir,
    "--datadogcfgpath",
    configDir,
    "list",
  ];

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    const result = await exec.getExecOutput("sudo", args, {
      ignoreReturnCode: true,
      silent: true,
    });
    if (result.exitCode === 0) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const tail = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf8").slice(-2000)
    : "(no daemon log found)";
  throw new Error(
    `system-probe command socket never became ready after ${POLL_MAX_ATTEMPTS} attempts.\n` +
      `--- daemon.log (tail) ---\n${tail}`,
  );
}

/** Start a host-wide activity dump. Returns whatever identifier the CLI printed (if any). */
export async function startDump(binaryPath: string, configDir: string): Promise<string> {
  const { stdout } = await exec.getExecOutput("sudo", [
    binaryPath,
    "runtime",
    "activity-dump",
    "-c",
    configDir,
    "--datadogcfgpath",
    configDir,
    "start",
  ]);
  return stdout.trim();
}

/** Stop the activity dump and resolve the emitted dump file's path. */
export async function stopDump(binaryPath: string, configDir: string): Promise<string> {
  const { stdout } = await exec.getExecOutput("sudo", [
    binaryPath,
    "runtime",
    "activity-dump",
    "-c",
    configDir,
    "--datadogcfgpath",
    configDir,
    "stop",
  ]);

  const reported = extractPathFromOutput(stdout);
  if (reported && fs.existsSync(reported)) {
    return reported;
  }

  // Doc §6: reported paths can be misleading — fall back to the newest file
  // under the profiles output dir.
  return findNewestDumpFile(workDir());
}

export function extractPathFromOutput(output: string): string | null {
  const match = output.match(/\/\S+\.(json|protobuf|msgpack|dot|profile)\b/);
  return match ? match[0] : null;
}

export function findNewestDumpFile(dir: string): string {
  const profilesDir = path.join(dir, "profiles");
  if (!fs.existsSync(profilesDir)) {
    return "";
  }
  const files = fs
    .readdirSync(profilesDir)
    .map((name) => path.join(profilesDir, name))
    .filter((p) => fs.statSync(p).isFile());
  if (files.length === 0) {
    return "";
  }
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

/** Kill the daemon by exact binary name (never pattern-match cmdline — doc §8). */
export async function killDaemon(): Promise<void> {
  await exec.getExecOutput("sudo", ["pkill", "-9", "-x", "system-probe"], {
    ignoreReturnCode: true,
    silent: true,
  });
}
