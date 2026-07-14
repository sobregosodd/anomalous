// Minimal, dependency-free helpers for GitHub Actions.
//
// State set here in `main` is readable in `post` via environment variables
// named STATE_<key>. This mirrors what @actions/core save/getState do, without
// pulling in the toolkit (keeps the action bundler-free).
"use strict";

const fs = require("fs");

/** Persist a key/value so the `post` step can read it back. */
function saveState(key, value) {
  const file = process.env.GITHUB_STATE;
  if (!file) {
    // Running outside Actions (e.g. local `node --check`/manual run).
    return;
  }
  fs.appendFileSync(file, `${key}=${value}\n`, { encoding: "utf8" });
}

/** Read a value previously stored with saveState (available in `post`). */
function getState(key) {
  return process.env[`STATE_${key}`] || "";
}

/** Read an action input (inputs arrive as INPUT_<NAME>, upper-cased). */
function getInput(name) {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  return (process.env[key] || "").trim();
}

/** Emit a workflow notice/error annotation. */
function notice(msg) {
  process.stdout.write(`::notice::${msg}\n`);
}
function error(msg) {
  process.stdout.write(`::error::${msg}\n`);
}

module.exports = { saveState, getState, getInput, notice, error };
