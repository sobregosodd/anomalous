"""Skeleton tests for the dump parser.

The parser is not implemented yet, so the behavioural test is xfail for now and
will start passing once ``parse`` is real. The schema smoke test runs today.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from anomalous.dump.parser import parse
from anomalous.dump.schema import Process, RunProfile


def test_runprofile_construction() -> None:
    profile = RunProfile(run_id="r1", workflow="ci", processes=[Process(1, None, "/bin/sh")])
    assert profile.run_id == "r1"
    assert profile.processes[0].exe == "/bin/sh"


@pytest.mark.xfail(reason="parser not implemented yet", raises=NotImplementedError, strict=True)
def test_parse_sample_dump(tmp_path: Path) -> None:
    sample = tmp_path / "dump.bin"
    sample.write_bytes(b"")
    profile = parse(sample)
    assert isinstance(profile, RunProfile)
