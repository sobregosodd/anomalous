"""Skeleton tests for scoring/reporting.

``to_json`` works today; end-to-end analysis is xfail until the model and parser
are implemented.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from anomalous.detect.analyze import analyze
from anomalous.report.findings import Finding, to_json


def test_findings_to_json_roundtrip() -> None:
    findings = [Finding("network", "1.2.3.4", "high", -0.7, "new outbound IP")]
    payload = json.loads(to_json(findings))
    assert payload[0]["subject"] == "1.2.3.4"
    assert payload[0]["category"] == "network"


@pytest.mark.xfail(reason="analysis not implemented yet", raises=NotImplementedError, strict=True)
def test_analyze_run(tmp_path: Path) -> None:
    dump = tmp_path / "dump.bin"
    dump.write_bytes(b"")
    analyze(dump)
