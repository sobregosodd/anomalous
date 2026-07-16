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

Add Anomalous as the first step of your job:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: sobregosodd/anomalous@v1
      - run: ./build-and-test.sh   # your existing steps, unchanged
```

That's it for collection.

## Documentation

- [Architecture](ARCHITECTURE.md) — how the pieces fit together and the packaging trade-offs.

## License

Anomalous is licensed under the Apache License, Version 2.0 — the same license as the
[Datadog Agent](https://github.com/datadog/datadog-agent) it builds on. See [LICENSE](LICENSE).
