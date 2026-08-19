// Anomalous collection action — POST entry.
//
// Runs automatically at the end of the job, even if a user step failed. This is
// the whole reason the action is a Node action rather than composite.
// Responsibilities:
//   1. Stop the activity dump started in main.
//   2. Upload the dump as a workflow run artifact (so the scheduled trainer and
//      downstream consumers can read it back).
//   3. Score the dump against the trained model with `anomalous analyze` and
//      surface findings — advisory (notice/warning), not a job gate (yet).

import * as path from "path";
import * as fs from "fs";
import * as core from "@actions/core";
import * as probe from "./probe";

async function run(): Promise<void> {
  if (core.getState("started") !== "true") {
    core.notice(
      "Anomalous: collection was never started; nothing to finalize.",
    );
    return;
  }

  const dumpName = core.getState("dump_name") || "anomalous-dump";
  const binaryPath = core.getState("binary_path");
  const configDir = core.getState("config_dir");
  const uploadArtifact =
    (core.getInput("upload-artifact") || "true") === "true";
  const modelPath = core.getInput("model-path") || "anomalous-model.joblib";

  // __dirname is dist/post/ once bundled, so the action/repo root (with
  // pyproject.toml) is two levels up — same as main.ts.
  const actionDir = path.join(__dirname, "..", "..");

  core.notice(`Anomalous: finalizing collection (dump="${dumpName}")`);

  const dumpPath = await probe.stopDump(binaryPath, configDir);
  await probe.killDaemon();

  if (dumpPath) {
    core.notice(`Anomalous: activity dump stopped (path="${dumpPath}")`);
  } else {
    core.error(
      "Anomalous: activity dump stopped, but no dump file could be located.",
    );
  }

  // (2) Upload the dump as an artifact regardless of analysis — the scheduled
  // trainer (train.yml) consumes these to build the model. This happens even if
  // no trained model is present yet, so the very first runs still feed training.
  if (uploadArtifact && dumpPath) {
    try {
      const uploaded = await probe.uploadDump(dumpPath, dumpName);
      if (uploaded) {
        core.notice(
          `Anomalous: dump uploaded as artifact "${dumpName}" (id=${uploaded.id}, size=${uploaded.size}).`,
        );
      } else {
        core.error("Anomalous: upload skipped — dump file not found.");
      }
    } catch (err) {
      core.setFailed(
        `Anomalous: artifact upload failed: ${(err as Error).message}`,
      );
      return;
    }
  }

  // (3) Score the dump against the trained model. The model is produced by the
  // scheduled trainer (train.yml) and must be supplied by the consumer's
  // workflow (e.g. via a download-artifact step before this action). If absent,
  // skip scoring — the dump is still uploaded above for future training.
  if (!dumpPath) {
    return;
  }
  if (!fs.existsSync(modelPath)) {
    core.notice(
      `Anomalous: no trained model found at "${modelPath}" — skipping analysis. ` +
        "The dump was still uploaded as an artifact for future training.",
    );
    return;
  }

  core.notice(`Anomalous: scoring dump against model "${modelPath}"...`);
  try {
    const result = await probe.runAnalyze(dumpPath, modelPath, actionDir);
    if (result.exitCode === 0) {
      core.notice("Anomalous: analysis complete — no anomalies detected.");
    } else if (result.exitCode === 1) {
      // `anomalous analyze` exits 1 when findings exist (cli.py). Findings are
      // advisory for now — surface as a warning, do not fail the job. Gating is
      // a later deny-mode concern (ARCHITECTURE §6).
      core.warning(
        `Anomalous: analysis flagged anomalies:\n${result.stdout.trim()}`,
      );
    } else {
      // Any other non-zero is a real error (e.g. the Python ML chain is still a
      // NotImplementedError stub). Surface it but don't fail the collection job.
      core.error(
        `Anomalous: analysis failed (exit ${result.exitCode}). ` +
          `stderr: ${result.stderr.trim()}`,
      );
    }
  } catch (err) {
    core.error(
      `Anomalous: analysis invocation failed: ${(err as Error).message}`,
    );
  }
}

run().catch((err: Error) => {
  core.setFailed(`Anomalous post failed: ${err.message}`);
});
