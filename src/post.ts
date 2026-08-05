// Anomalous collection action — POST entry.
//
// Runs automatically at the end of the job, even if a user step failed. This is
// the whole reason the action is a Node action rather than composite.
// Responsibilities:
//   1. Stop the activity dump started in main.
//   2. Collect the resulting dump file.
//   3. Optionally upload it as a build artifact for downstream analysis.

import * as core from "@actions/core";
import * as probe from "./probe";

async function run(): Promise<void> {
  if (core.getState("started") !== "true") {
    core.notice("Anomalous: collection was never started; nothing to finalize.");
    return;
  }

  const dumpName = core.getState("dump_name") || "anomalous-dump";
  const binaryPath = core.getState("binary_path");
  const configDir = core.getState("config_dir");
  const uploadArtifact = (core.getInput("upload-artifact") || "true") === "true";

  core.notice(`Anomalous: finalizing collection (dump="${dumpName}")`);

  const dumpPath = await probe.stopDump(binaryPath, configDir);
  await probe.killDaemon();

  if (dumpPath) {
    core.notice(`Anomalous: activity dump stopped (path="${dumpPath}")`);
  } else {
    core.error("Anomalous: activity dump stopped, but no dump file could be located.");
  }

  // TODO(collection): if uploadArtifact, upload dumpPath as `dumpName` so the
  //   analyze action / trainer can consume it. (e.g. @actions/artifact)
  void uploadArtifact;
  void dumpPath;
}

run().catch((err: Error) => {
  core.setFailed(`Anomalous post failed: ${err.message}`);
});
