# Testing a standalone `system-probe` feature on a dev VM (binary already built/deployed)

Generic recipe for validating a `system-probe` (CWS/runtime-security or otherwise) config-driven feature end-to-end on a real VM, assuming the binary is already present — no build step.

## 1. Pick a scratch config directory

Use one persistent directory per feature under test, e.g. `~/<feature>-test/`. Keep it around between sessions — no need to recreate it each time.

```bash
mkdir -p ~/<feature>-test/profiles   # or whatever output subdirs the feature needs
```

## 2. Config files

**`system-probe.yaml`** — keep this as minimal as the feature under test allows. If the feature is supposed to be a "single switch" that pulls up its own prerequisites, deliberately omit those prerequisite keys and prove they get pulled up automatically rather than pre-enabling them yourself.

```yaml
system_probe_config:
  sysprobe_socket: /home/<user>/<feature>-test/sysprobe.sock

runtime_security_config:
  socket: /home/<user>/<feature>-test/runtime-security.sock
  # ... only the config keys strictly required to exercise the feature
```

**`datadog.yaml`** — required even when running `system-probe` standalone, because it still loads a core-agent config. Pin `hostname` since there's no core agent running to supply one.

```yaml
api_key: "00000000000000000000000000000000"
hostname: "<vm-name>"
runtime_security_config:
  socket: /home/<user>/<feature>-test/runtime-security.sock
```

Keep a `.full` variant of any config alongside if you want to diff a minimal vs. fully-specified setup.

## 3. Locate the binary and confirm it's the build you expect

```bash
which system-probe || ls -la <path-to>/system-probe
sudo <path-to>/system-probe version
```

If you're testing a specific fix, confirm the binary's build timestamp/commit matches what you expect before spending time on a run that can't possibly show the fix.

## 4. Run the daemon (own terminal/background task)

```bash
sudo <path-to>/system-probe run -c ~/<feature>-test --datadogcfgpath ~/<feature>-test 2>&1 | tee ~/<feature>-test/daemon.log
```

Poll for the command socket instead of guessing a sleep duration — eBPF program loading dominates startup time and varies:

```bash
for i in $(seq 1 20); do
  sudo <path-to>/system-probe runtime activity-dump -c ~/<feature>-test --datadogcfgpath ~/<feature>-test list >/dev/null 2>&1 && break
  sleep 5
done
```

Confirm the relevant module actually started — a live process is not proof the feature initialized:

```bash
grep -aiE "cws consumer initialized|runtime security started|module event_monitor (started|disabled)" ~/<feature>-test/daemon.log
```

## 5. Exercise the feature

Run CLI commands **inline**, never through a shell variable — zsh does not word-split `VAR="sudo ..."; $VAR subcommand`, so the command silently no-ops instead of erroring:

```bash
sudo <path-to>/system-probe runtime <cmd> -c ~/<feature>-test --datadogcfgpath ~/<feature>-test <start-subcommand>

# generate representative activity covering the surfaces the feature should capture
# (process, file, DNS, network, whatever applies)
id; whoami; cat /etc/passwd; nslookup example.com; wget -q example.com -O /tmp/x.html
sleep 4   # allow events to settle before stopping

sudo <path-to>/system-probe runtime <cmd> -c ~/<feature>-test --datadogcfgpath ~/<feature>-test <stop-subcommand>
```

## 6. Inspect output

If output is a binary/protobuf format, a quick `strings` grep is often enough for a sanity check before decoding fully:

```bash
sudo strings ~/<feature>-test/profiles/*.<ext> | grep -aoE "<expected-pattern>"
```

For structured (JSON) output, be aware CLI "generate encoding"-style commands may report a misleading output path — `find` for the actual file if the reported path doesn't exist:

```bash
sudo find / -name "<expected-file>.json" 2>/dev/null
```

## 7. Prove a fix is real, not just "test still passes"

Don't trust a passing test alone — temporarily revert the fix, rerun the exact same test/manual repro, confirm it now **fails**, then restore the fix. Since there's no build step here, this check has to happen at the unit-test level (or by swapping in a differently-built binary if one is available), not by re-running the manual repro against the same binary:

```bash
git stash                 # or manually comment out the fix
dda inv -- -e test --targets=<affected-package>   # must FAIL
git stash pop                                       # restore the fix
dda inv -- -e test --targets=<affected-package>   # must PASS
```

This catches vacuous tests (e.g. asserting on a struct field the code path never actually reads). If no build step is available at all, treat the manual VM run purely as a config/wiring smoke test, not as proof of the fix itself — that proof has to come from unit tests or a separately built binary.

## 8. Teardown

```bash
sudo pkill -9 -x system-probe   # -x for EXACT match; never -f "system-probe run" — that pattern
                                 # also matches your own ssh/tmux command line and kills your session
sudo rm -f ~/<feature>-test/*.sock ~/<feature>-test/profiles/*
```

Leave the config directory itself in place for reuse in the next session.

## Common gotchas to check for in any config-driven feature

- A single "convenience" config switch that's supposed to pull up prerequisite settings must d[118;1:3uo so on the **raw** config, before any downstream code reads the individual prerequisite keys — otherwise a later "if disabled, force everything off" branch silently undoes it.
- Module/feature enablement decisions are often made once at startup from raw config, not from the final parsed struct — a fix that only touches the parsed struct after that decision point won't take effect.
- Any in-kernel or in-process dedup/state maps are typically global and persist across start/stop cycles — if the feature has a "start capture window" concept, check whether repeated activity across separate windows gets silently suppressed unless that state is explicitly flushed.
- Without a build step, you're always testing whatever binary is already on disk — double-check its provenance (§3) before drawing conclusions from a run.
