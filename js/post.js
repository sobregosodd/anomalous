// Anomalous collection action — POST entry.
//
// Runs automatically at the end of the job, even if a user step failed. This is
// the whole reason the action is a Node action rather than composite.
// Responsibilities:
//   1. Stop the activity dump started in main.
//   2. Collect the resulting dump file.
//   3. Optionally upload it as a build artifact for downstream analysis.
"use strict";

const { getState, getInput, notice, error } = require("./state");

async function run() {
  if (getState("started") !== "true") {
    notice("Anomalous: collection was never started; nothing to finalize.");
    return;
  }

  const dumpName = getState("dump_name") || "anomalous-dump";
  const dumpId = getState("dump_id");
  const uploadArtifact = (getInput("upload-artifact") || "true") === "true";

  notice(`Anomalous: finalizing collection (dump="${dumpName}")`);

  // TODO(collection): stop the activity dump identified by dumpId and locate the
  //   emitted dump file on disk.
  void dumpId;
  const dumpPath = ""; // TODO: real path from the agent

  // TODO(collection): if uploadArtifact, upload dumpPath as `dumpName` so the
  //   analyze action / trainer can consume it. (e.g. @actions/artifact)
  void uploadArtifact;
  void dumpPath;

  throw new Error("NotImplemented: activity-dump stop + upload (js/post.js)");
}

run().catch((err) => {
  error(`Anomalous post failed: ${err.message}`);
  process.exitCode = 1;
});
