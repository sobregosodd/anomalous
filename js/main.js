// Anomalous collection action — MAIN entry.
//
// Runs as the first step of the job. Responsibilities:
//   1. Install the Datadog Agent (CWS) on the runner.
//   2. Start a host-wide activity dump so every subsequent user step is observed.
//   3. Save state (e.g. dump id / paths) for the `post` step to finalize.
//
// All heavy lifting is shell-level here; the ML lives in the Python package.
"use strict";

const { saveState, getInput, notice, error } = require("./state");

async function run() {
  const dumpName = getInput("dump-name") || "anomalous-dump";
  const agentVersion = getInput("agent-version");

  notice(`Anomalous: starting collection (dump="${dumpName}")`);

  // TODO(collection): install the Datadog Agent on the runner.
  //   - fetch + install (agentVersion || latest)
  //   - enable Cloud Workload Security (CWS) / runtime security
  //   See: https://github.com/datadog/datadog-agent
  void agentVersion;

  // TODO(collection): start a *host-wide* activity dump (not cgroup-scoped),
  //   since user steps run on the VM host, not in a child container. Capture the
  //   dump identifier / output path returned by the agent.
  const dumpId = ""; // TODO: real id from the agent

  // Persist for the post step.
  saveState("dump_name", dumpName);
  saveState("dump_id", dumpId);
  saveState("started", "true");

  // Placeholder until the steps above are implemented.
  throw new Error("NotImplemented: agent install + activity-dump start (js/main.js)");
}

run().catch((err) => {
  error(`Anomalous main failed: ${err.message}`);
  process.exitCode = 1;
});
