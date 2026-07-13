"""Command-line entrypoint for the Anomalous ML side.

    anomalous parse   <dump>              # parse a dump and print a summary
    anomalous train   <dumps-dir>         # build/update the behavioural model
    anomalous analyze <dump>              # score a run against the model

Wired to the library modules; the underlying logic is still TODO.
"""

from __future__ import annotations

from pathlib import Path

import typer

from anomalous import __version__
from anomalous.config import DEFAULT_SETTINGS, Settings
from anomalous.detect.analyze import analyze as analyze_run
from anomalous.dump.parser import parse as parse_dump
from anomalous.model.train import train as train_model
from anomalous.report.findings import to_json

app = typer.Typer(help="Runtime behavioural anomaly detection for GitHub Actions pipelines.")


@app.command()
def version() -> None:
    """Print the installed version."""
    typer.echo(__version__)


@app.command()
def parse(dump: Path) -> None:
    """Parse an activity DUMP and print a short summary."""
    profile = parse_dump(dump)
    typer.echo(
        f"run={profile.run_id} workflow={profile.workflow} "
        f"procs={len(profile.processes)} conns={len(profile.connections)} "
        f"files={len(profile.files)} dns={len(profile.dns)}"
    )


@app.command()
def train(
    dumps_dir: Path,
    model_out: Path = typer.Option(DEFAULT_SETTINGS.model_path, help="Where to write the model."),
) -> None:
    """Train/update the behavioural model from DUMPS_DIR."""
    settings = Settings(model_path=model_out)
    out = train_model(dumps_dir, settings)
    typer.echo(f"model written to {out}")


@app.command()
def analyze(
    dump: Path,
    model: Path = typer.Option(DEFAULT_SETTINGS.model_path, help="Trained model to score against."),
) -> None:
    """Score a run's DUMP against the model and print findings as JSON."""
    settings = Settings(model_path=model)
    findings = analyze_run(dump, settings)
    typer.echo(to_json(findings))
    if findings:
        raise typer.Exit(code=1)  # non-zero so a workflow can gate on it later


if __name__ == "__main__":
    app()
