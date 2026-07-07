"""The ``Finding`` type and output formatters (JSON now, SARIF stub)."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Sequence

# Signal categories a finding can belong to.
Category = str  # one of: "process" | "network" | "file" | "dns"
Severity = str  # one of: "info" | "low" | "medium" | "high"


@dataclass
class Finding:
    """A single anomaly surfaced for a run.

    Attributes:
        category: Which behavioural signal triggered it.
        subject: The offending value (e.g. an IP, path, exe, domain).
        severity: Rough severity bucket.
        score: Model score / distance backing the finding.
        message: Human-readable explanation for the report.
    """

    category: Category
    subject: str
    severity: Severity
    score: float
    message: str


def to_json(findings: Sequence[Finding]) -> str:
    """Serialize findings as pretty JSON."""
    return json.dumps([asdict(f) for f in findings], indent=2)


def to_sarif(findings: Sequence[Finding]) -> str:
    """Serialize findings as SARIF for GitHub code scanning.

    TODO(report): emit a minimal valid SARIF 2.1.0 document so anomalies can show
        up in the Security tab. For now this is a stub.
    """
    raise NotImplementedError("SARIF output not implemented yet")
