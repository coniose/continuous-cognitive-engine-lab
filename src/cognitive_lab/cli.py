from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

from .training_lab import serve_training_lab
from .transcription import transcribe_sessions
from .xr_bridge import LESSON_IDS


def send_xr_command(host: str, port: int, payload: dict) -> dict:
    request = urllib.request.Request(
        f"http://{host}:{port}/api/xr/commands",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read())


def main() -> None:
    parser = argparse.ArgumentParser(prog="cognitive-lab")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--runs-dir", type=Path, default=Path("runs/training"))
    parser.add_argument("--transcribe", action="store_true", help="transcribe recorded sessions")
    parser.add_argument("--model-size", default="small")
    parser.add_argument("--reprocess", action="store_true", help="reprocess already transcribed sessions")
    parser.add_argument("--show-lesson", choices=sorted(LESSON_IDS), help="open an XR lesson on the running lab")
    parser.add_argument("--say", help="show (and speak) a caption inside the XR lab")
    args = parser.parse_args()
    if args.show_lesson or args.say:
        if args.show_lesson:
            print(json.dumps(send_xr_command(args.host, args.port, {"action": "open_lesson", "lesson": args.show_lesson}), ensure_ascii=False))
        if args.say:
            print(json.dumps(send_xr_command(args.host, args.port, {"action": "caption", "text": args.say}), ensure_ascii=False))
        return
    if args.transcribe:
        print(json.dumps(transcribe_sessions(args.runs_dir, args.model_size, not args.reprocess), ensure_ascii=False, indent=2))
        return
    serve_training_lab(args.host, args.port, args.runs_dir)


if __name__ == "__main__":
    main()
