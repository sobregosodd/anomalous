"""Offline trainer: aggregate historical dumps into a model.

Invoked on a schedule (see ``.github/workflows/train.yml``). Reads the activity
dumps accumulated across recent runs, fits a model, and persists it.
"""

from __future__ import annotations

from pathlib import Path

from anomalous.config import DEFAULT_SETTINGS, Settings
from anomalous.dump.parser import parse
from anomalous.model.sklearn_model import SklearnModel


def train(dumps_dir: Path, settings: Settings = DEFAULT_SETTINGS) -> Path:
    """Train a model from every dump under ``dumps_dir`` and persist it.

    Args:
        dumps_dir: Directory containing collected activity dumps.
        settings: Thresholds and output path.

    Returns:
        Path to the persisted model.

    TODO(train):
        - discover dump files under ``dumps_dir`` and ``parse`` each into a RunProfile
        - guard on ``settings.min_train_runs`` (don't ship a model trained on too few runs)
        - ``model = SklearnModel(); model.fit(profiles); model.save(settings.model_path)``
    """
    profiles = [parse(p) for p in sorted(dumps_dir.glob("*"))]  # noqa: F841  (TODO: use)
    model = SklearnModel(threshold=settings.anomaly_threshold)  # noqa: F841  (TODO: fit)
    raise NotImplementedError("model training pipeline not implemented yet")
