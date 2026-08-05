// Anomalous collection action — MAIN entry.
//
// Runs as the first step of the job. Responsibilities:
//   1. Extract and run the bundled system-probe binary (CWS runtime-security).
//   2. Start a host-wide activity dump so every subsequent user step is observed.
//   3. Save state (e.g. dump id / paths) for the `post` step to finalize.
//
// All heavy lifting is shell-level here; the ML lives in the Python package.

import * as path from "path";
import * as core from "@actions/core";
import * as probe from "./probe";

async function run(): Promise<void> {
  const dumpName = core.getInput("dump-name") || "anomalous-dump";
  // NOTE: `agent-version` is currently unused — collection runs off the
  // bundled bin/system-probe.zip binary rather than an installed Datadog
  // Agent, so there is no version to select yet.

  core.notice(`Anomalous: starting collection (dump="${dumpName}")`);

  // __dirname is dist/main/ once bundled, so the action/repo root is two levels up.
  const actionDir = path.join(__dirname, "..", "..");
  const binaryPath = await probe.extractBinary(actionDir);
  const configDir = probe.writeConfigs(dumpName);

  // Host-wide dump: the daemon runs directly on the VM host (not scoped to a
  // container/cgroup), since user steps run on the runner host itself.
  const { pid, logPath } = probe.startDaemon(binaryPath, configDir);
  await probe.waitForSocket(binaryPath, configDir, logPath);
  const dumpId = await probe.startDump(binaryPath, configDir);

  // Persist for the post step.
  core.saveState("dump_name", dumpName);
  core.saveState("dump_id", dumpId);
  core.saveState("binary_path", binaryPath);
  core.saveState("config_dir", configDir);
  core.saveState("daemon_pid", String(pid));
  core.saveState("started", "true");

  core.notice(`Anomalous: activity dump started (pid=${pid})`);
}

run().catch((err: Error) => {
  core.setFailed(`Anomalous main failed: ${err.message}`);
});
