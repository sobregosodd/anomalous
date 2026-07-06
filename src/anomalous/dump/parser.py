"""Parse a Datadog CWS activity dump into a ``RunProfile``."""

from __future__ import annotations

from pathlib import Path

from anomalous.dump.schema import RunProfile


def parse(path: Path) -> RunProfile:
    """Parse an activity dump file into a normalized :class:`RunProfile`.

    Args:
        path: Path to a dump emitted by the collection action.

    Returns:
        A populated :class:`RunProfile`.

    TODO(parser): implement real parsing of the CWS activity-dump format.
        The agent can emit protobuf / msgpack / json / dot / profile; decide the
        canonical input format and map its process/network/file/DNS records onto
        the schema dataclasses. Confirm format against a real sample dump.
    """
    raise NotImplementedError("CWS activity-dump parsing not implemented yet")
