"""Normalized representation of a single CI run's runtime behaviour.

A ``RunProfile`` is the parser's output and the unit that features are extracted
from. Keep these dataclasses dependency-free and stable — everything downstream
(features, model, detection) depends on their shape.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Process:
    """A process observed during the run."""

    pid: int
    ppid: int | None
    exe: str
    argv: list[str] = field(default_factory=list)


@dataclass
class Connection:
    """An outbound network connection."""

    proto: str  # "tcp" | "udp"
    dest_ip: str
    dest_port: int


@dataclass
class FileAccess:
    """A file interaction (open/read/write/exec)."""

    path: str
    mode: str


@dataclass
class DNSRequest:
    """A DNS resolution requested during the run."""

    qname: str
    qtype: str = "A"


@dataclass
class RunProfile:
    """All behaviour captured for one workflow run."""

    run_id: str
    workflow: str
    processes: list[Process] = field(default_factory=list)
    connections: list[Connection] = field(default_factory=list)
    files: list[FileAccess] = field(default_factory=list)
    dns: list[DNSRequest] = field(default_factory=list)
