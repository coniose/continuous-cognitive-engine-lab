from __future__ import annotations

import argparse
import json
from pathlib import Path

from .training_lab import serve_training_lab
from .transcription import transcribe_sessions


def main() -> None:
    parser = argparse.ArgumentParser(prog="cognitive-lab")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--runs-dir", type=Path, default=Path("runs/training"))
    parser.add_argument("--transcribe", action="store_true", help="transcribe recorded sessions")
    parser.add_argument("--model-size", default="small")
    args = parser.parse_args()
    if args.transcribe:
        print(json.dumps(transcribe_sessions(args.runs_dir, args.model_size), ensure_ascii=False, indent=2))
        return
    serve_training_lab(args.host, args.port, args.runs_dir)


if __name__ == "__main__":
    main()
