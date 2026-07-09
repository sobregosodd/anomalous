"""scikit-learn anomaly model (IsolationForest-based).

This is the default concrete :class:`AnomalyModel`. It vectorizes each run via
``features.extract.to_features`` and fits an unsupervised outlier detector.
"""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from anomalous.config import DEFAULT_SETTINGS
from anomalous.dump.schema import RunProfile
from anomalous.model.base import AnomalyModel
from anomalous.report.findings import Finding


class SklearnModel(AnomalyModel):
    """Unsupervised anomaly detector backed by scikit-learn."""

    def __init__(self, threshold: float = DEFAULT_SETTINGS.anomaly_threshold) -> None:
        self.threshold = threshold
        self._estimator = None  # set in fit()/load()

    def fit(self, profiles: Sequence[RunProfile]) -> None:
        """Fit an IsolationForest over the feature vectors of ``profiles``.

        TODO(model): build the feature matrix via ``to_features``, then
            ``self._estimator = IsolationForest(...).fit(X)``. Choose
            contamination / n_estimators and any scaling. Persist enough state
            (estimator + feature version) for reproducible scoring.
        """
        raise NotImplementedError("SklearnModel.fit not implemented yet")

    def score(self, profile: RunProfile) -> list[Finding]:
        """Score one run; emit findings when it falls below the threshold.

        TODO(model): vectorize ``profile``, compute
            ``self._estimator.decision_function(x)``, and translate a below-
            threshold score into one or more :class:`Finding` objects with a
            human-readable explanation of what looked off.
        """
        raise NotImplementedError("SklearnModel.score not implemented yet")

    def save(self, path: Path) -> None:
        """Persist the estimator (e.g. via joblib).

        TODO(model): ``joblib.dump({"estimator": ..., "threshold": ...,
            "feature_version": ...}, path)``.
        """
        raise NotImplementedError("SklearnModel.save not implemented yet")

    @classmethod
    def load(cls, path: Path) -> "SklearnModel":
        """Load a persisted estimator.

        TODO(model): read back the dict written by ``save`` and reconstruct.
        """
        raise NotImplementedError("SklearnModel.load not implemented yet")
