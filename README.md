# Anomalous

**Spot the baddies in your GitHub Actions pipelines.**

CI pipelines are repetitive by nature — the same builds, tests, and deploys, run
after run. Anomalous learns what a pipeline normally does at runtime and flags the
runs that don't fit that pattern, so a compromised action or an injected step that
reaches out to exfiltrate secrets or pull a payload stands out instead of blending in.

It drops into a workflow as a **single action**, captures what actually happens during
a run (processes, network connections, files, DNS), learns each pipeline's fingerprint,
and surfaces the outliers — with a low false-positive rate.

Runtime data collection is powered by the [Datadog Agent](https://github.com/datadog/datadog-agent)
and its Cloud Workload Security (CWS) activity dumps.

## Features

- **One-line integration** — add a single action as the first step; your existing steps stay untouched.
- **Runtime behavioural capture** — process lineage, network connections, file access, and DNS, collected on the runner via the Datadog Agent (CWS activity dumps).
- **Learned per-pipeline baseline** — a behavioural model built from your own historical runs, refreshed on a schedule.
- **Anomaly scoring** — every run is compared against the baseline and deviations are surfaced as findings.
- **Low noise** — alerts fire on genuinely out-of-profile behaviour, not routine variation.
- **Detect first, block later** — starts in report-only mode, with a path to gating anomalous runs.

## Quick start

Add Anomalous as the first step of your job. It starts a host-wide activity dump
on entry, then — in its `post:` step, which runs even if a later step fails —
stops the dump, uploads it as an artifact, and scores it against a trained model.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sobregosodd/anomalous@v1
        with:
          model-path: anomalous-model.joblib   # trained by the scheduled trainer
      - run: ./build-and-test.sh   # your existing steps, unchanged
```

The model is built off the critical path by a scheduled trainer
(`.github/workflows/train.yml`, daily) that accumulates collected dumps and
uploads an `anomalous-model` artifact. Your workflow must make that model
available to the action (e.g. by downloading the latest model artifact before
the `uses:` step). If no model is present yet, analysis is skipped — the dump
is still uploaded so the trainer can build the first model from accumulated
runs. See [`.github/workflows/example.yml`](.github/workflows/example.yml) for a
complete reference workflow that resolves and downloads the latest model.

## Documentation

- [Architecture](ARCHITECTURE.md) — how the pieces fit together and the packaging trade-offs.

## License

Anomalous is licensed under the Apache License, Version 2.0 — the same license as the
[Datadog Agent](https://github.com/datadog/datadog-agent) it builds on. See [LICENSE](LICENSE).
