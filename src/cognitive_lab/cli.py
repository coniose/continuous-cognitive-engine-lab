from __future__ import annotations

import argparse
from pathlib import Path

from .training_lab import serve_training_lab


def main() -> None:
    parser = argparse.ArgumentParser(prog="cognitive-lab")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--runs-dir", type=Path, default=Path("runs/training"))
    args = parser.parse_args()
    serve_training_lab(args.host, args.port, args.runs_dir)


if __name__ == "__main__":
    main()
