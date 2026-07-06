"""Configuration and tunables for Anomalous."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

DEFAULT_MODEL_PATH = Path("anomalous-model.joblib")


@dataclass(frozen=True)
class Settings:
    """Runtime settings for training and detection.

    Attributes:
        model_path: Where the trained model is persisted / loaded from.
        anomaly_threshold: Score below which a run is flagged (model-dependent).
        min_train_runs: Minimum historical runs required to train a usable model.
    """

    model_path: Path = DEFAULT_MODEL_PATH
    anomaly_threshold: float = 0.0
    min_train_runs: int = 10


DEFAULT_SETTINGS = Settings()
