"""The ``AnomalyModel`` interface.

Keeping a small abstract interface lets the scikit-learn model be swapped for an
alternative later without touching the trainer, detector, or CLI.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Sequence

from anomalous.dump.schema import RunProfile
from anomalous.report.findings import Finding


class AnomalyModel(ABC):
    """A model that learns normal run behaviour and scores new runs."""

    @abstractmethod
    def fit(self, profiles: Sequence[RunProfile]) -> None:
        """Learn a baseline from historical run profiles."""

    @abstractmethod
    def score(self, profile: RunProfile) -> list[Finding]:
        """Score a single run and return any anomaly findings (empty if normal)."""

    @abstractmethod
    def save(self, path: Path) -> None:
        """Persist the fitted model to ``path``."""

    @classmethod
    @abstractmethod
    def load(cls, path: Path) -> "AnomalyModel":
        """Load a previously persisted model from ``path``."""
