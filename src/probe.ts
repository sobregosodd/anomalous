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
import { DefaultArtifactClient } from "@actions/artifact";

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

/**
 * Write the system-probe.yaml + datadog.yaml pair (doc §2).
 *
 * `system-probe.yaml` is the known-working full config from doc §2 ("Reference:
 * a known-working full config"), not the stripped-minimal one. The minimal config
 * omits the security_profile consumer block and the activity_dump.local_storage
 * output directory — without both, activity_dump produces dump files that nothing
 * reads, and you get an empty profile silently. See bin/system-probe.md for the
 * rationale on each load-bearing key.
 */
export function writeConfigs(dumpName: string): string {
  const dir = workDir();
  const configDir = path.join(dir, "config");
  fs.mkdirSync(configDir, { recursive: true });

  const sysprobeSocket = path.join(dir, "sysprobe.sock");
  const runtimeSecuritySocket = path.join(dir, "runtime-security.sock");
  const profilesDir = path.join(dir, "profiles");
  fs.mkdirSync(profilesDir, { recursive: true });
  const hostname = `anomalous-${dumpName}`;

  fs.writeFileSync(
    path.join(configDir, "system-probe.yaml"),
    [
      "system_probe_config:",
      `  sysprobe_socket: ${sysprobeSocket}`,
      "",
      "runtime_security_config:",
      "  enabled: true",
      `  socket: ${runtimeSecuritySocket}`,
      "",
      "  activity_dump:",
      "    enabled: true",
      "    local_storage:",
      `      output_directory: ${profilesDir}`,
      "      formats: [profile]",
      "      max_dumps_count: 100",
      "      compression: false",
      "",
      "  security_profile:",
      "    enabled: true",
      `    dir: ${profilesDir}   # must match activity_dump.local_storage.output_directory`,
      "    v2:",
      "      enabled: true",
      "      host_dump:",
      "        enabled: true",
      "      event_types: [exec, dns, bind, connect, open]",
      "      sample_refresh_period: 30s",
      "      max_dump_size: 5120",
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
export function startDaemon(
  binaryPath: string,
  configDir: string,
): DaemonHandle {
  const dir = workDir();
  const logPath = path.join(dir, "daemon.log");
  const logFd = fs.openSync(logPath, "a");

  const child = spawn(
    "sudo",
    [binaryPath, "run", "-c", configDir, "--datadogcfgpath", configDir],
    // cwd: write the daemon's runtime artifacts (auth_token, ipc_cert.pem) into
    // the scratch work dir, not the action's own dist/ directory. Without this
    // the binary inherits the Node process cwd (dist/main under GHA) and drops
    // IPC credentials into the committed action tree.
    { detached: true, cwd: dir, stdio: ["ignore", logFd, logFd] },
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
export async function startDump(
  binaryPath: string,
  configDir: string,
): Promise<string> {
  const { stdout } = await exec.getExecOutput("sudo", [
    binaryPath,
    "runtime",
    "activity-dump",
    "-c",
    configDir,
    "--datadogcfgpath",
    configDir,
    "host",
    "start",
  ]);
  return stdout.trim();
}

/** Stop the activity dump and resolve the emitted dump file's path. */
export async function stopDump(
  binaryPath: string,
  configDir: string,
): Promise<string> {
  const { stdout } = await exec.getExecOutput("sudo", [
    binaryPath,
    "runtime",
    "activity-dump",
    "-c",
    configDir,
    "--datadogcfgpath",
    configDir,
    "host",
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

/** Result of an `anomalous analyze` run: stdout (findings JSON) + exit code. */
export interface AnalyzeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Upload the collected dump as a workflow run artifact so the scheduled trainer
 * (train.yml) and downstream consumers can read it back. Mirrors the
 * `actions/upload-artifact@v4` behavior via the `@actions/artifact` lib (a JS
 * post step cannot `uses:` another action, so we call the library directly).
 *
 * The system-probe daemon runs as root (sudo), so the dump files it writes are
 * root-owned and not readable by the `runner` user the Node post step runs as.
 * We `sudo chmod -R a+rX` the profiles dir first — without this the upload
 * fails with `EACCES: permission denied, open '...profile'` when the artifact
 * client tries to zip the file.
 *
 * @param dumpPath  Absolute path to the dump file emitted by `stopDump`.
 * @param dumpName  Logical artifact name (the action's `dump-name` input).
 * @returns         The artifact upload response (id + size), or null if the
 *                  dump file is missing.
 */
export async function uploadDump(
  dumpPath: string,
  dumpName: string,
): Promise<{
  id: number | undefined;
  size: number | undefined;
  digest: string | undefined;
} | null> {
  if (!dumpPath || !fs.existsSync(dumpPath)) {
    return null;
  }
  const rootDirectory = path.dirname(dumpPath);
  // Make the root-owned dump files readable by the non-root runner user.
  await exec.getExecOutput("sudo", ["chmod", "-R", "a+rX", rootDirectory], {
    ignoreReturnCode: true,
    silent: true,
  });
  const client = new DefaultArtifactClient();
  const response = await client.uploadArtifact(
    dumpName,
    [dumpPath],
    rootDirectory,
  );
  return { id: response.id, size: response.size, digest: response.digest };
}

/**
 * Install the `anomalous` Python package from the action checkout and run
 * `anomalous analyze <dump> --model <model>` to score the dump against the
 * trained model.
 *
 * Uses the system `python3` (preinstalled on GitHub-hosted ubuntu runners)
 * rather than `actions/setup-python` (a JS post step cannot `uses:` an action).
 * `ignoreReturnCode: true` so a findings exit-1 is returned, not thrown — the
 * caller decides whether findings are a warning or a job failure.
 *
 * @param dumpPath   Path to the dump file to score.
 * @param modelPath  Path to the trained model (joblib).
 * @param actionDir  Repo/action root containing `pyproject.toml` (for `pip install .`).
 * @returns          The exit code + captured stdout/stderr.
 */
export async function runAnalyze(
  dumpPath: string,
  modelPath: string,
  actionDir: string,
): Promise<AnalyzeResult> {
  // The dump file is root-owned (the daemon runs as root); the Python process
  // runs as the non-root runner user, so it can't read the dump either. Make it
  // readable before invoking the analyzer.
  await exec.getExecOutput(
    "sudo",
    ["chmod", "-R", "a+rX", path.dirname(dumpPath)],
    {
      ignoreReturnCode: true,
      silent: true,
    },
  );

  // Install the package (typer/numpy/scikit-learn deps resolved by pip).
  await exec.getExecOutput(
    "python3",
    ["-m", "pip", "install", "--quiet", actionDir],
    {
      silent: true,
    },
  );

  const result = await exec.getExecOutput(
    "anomalous",
    ["analyze", dumpPath, "--model", modelPath],
    { ignoreReturnCode: true, silent: true },
  );
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
