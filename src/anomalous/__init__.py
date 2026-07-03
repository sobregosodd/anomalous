"""Anomalous — runtime behavioural anomaly detection for GitHub Actions pipelines.

Pipeline of the Python (ML) side:

    dump file --parse--> RunProfile --extract--> features --score(model)--> Findings

Training aggregates many RunProfiles into a model; detection scores a single run
against the latest model. See ``ARCHITECTURE.md`` for how this fits the actions.
"""

__version__ = "0.1.0"
