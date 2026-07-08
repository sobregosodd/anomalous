"""Turn a ``RunProfile`` into a numeric feature vector for scikit-learn."""

from __future__ import annotations

import numpy as np

from anomalous.dump.schema import RunProfile


def to_features(profile: RunProfile) -> np.ndarray:
    """Convert a :class:`RunProfile` into a 1-D float feature vector.

    Args:
        profile: The normalized run behaviour.

    Returns:
        A 1-D ``np.ndarray`` of floats; the layout must be identical across
        training and detection.

    TODO(features): design the feature representation. Candidate signals:
        - counts/uniques of processes, connections, files, DNS
        - hashed/one-hot presence of process exes, dest ports, TLDs
        - egress fan-out (distinct dest IPs), non-loopback connection ratio
      Keep it deterministic and versioned so a model trained on version N is only
      ever scored against version-N features.
    """
    raise NotImplementedError("feature extraction not implemented yet")
