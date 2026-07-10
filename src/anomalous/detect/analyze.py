"""Score one run's dump against the trained model and return findings."""

from __future__ import annotations

from pathlib import Path

from anomalous.config import DEFAULT_SETTINGS, Settings
from anomalous.dump.parser import parse
from anomalous.model.sklearn_model import SklearnModel
from anomalous.report.findings import Finding


def analyze(dump_path: Path, settings: Settings = DEFAULT_SETTINGS) -> list[Finding]:
    """Parse a run's dump, score it against the latest model, return findings.

    Args:
        dump_path: The activity dump for the run under analysis.
        settings: Where to load the model from, plus thresholds.

    Returns:
        A list of :class:`Finding` (empty when the run looks normal).

    TODO(detect):
        - ``profile = parse(dump_path)``
        - ``model = SklearnModel.load(settings.model_path)``
        - ``return model.score(profile)``
      Handle the "no model yet" case gracefully (e.g. return an informational
      finding rather than crashing on the first-ever run).
    """
    profile = parse(dump_path)  # noqa: F841  (TODO: score)
    model = SklearnModel.load(settings.model_path)  # noqa: F841  (TODO: score)
    raise NotImplementedError("run analysis not implemented yet")
