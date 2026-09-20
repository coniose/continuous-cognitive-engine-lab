from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent / "static"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TrainingStore:
    def __init__(self, runs_dir: Path):
        self.runs_dir = runs_dir
        self.audio_dir = runs_dir / "audio"
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()

    def create_session(self, payload: dict) -> dict:
        session_id = f"session_{uuid.uuid4().hex[:12]}"
        record = {
            "session_id": session_id,
            "created_at": utc_now(),
            "updated_at": utc_now(),
            "status": "RECORDED",
            **payload,
        }
        with self.lock:
            self._write(session_id, record)
        return record

    def update_session(self, session_id: str, payload: dict) -> dict | None:
        with self.lock:
            path = self.runs_dir / f"{session_id}.json"
            if not path.exists():
                return None
            record = json.loads(path.read_text(encoding="utf-8"))
            record.update(payload)
            record["updated_at"] = utc_now()
            self._write(session_id, record)
            return record

    def save_audio(self, session_id: str, content_type: str, body: bytes) -> str:
        extension = ".webm" if "webm" in content_type else ".audio"
        path = self.audio_dir / f"{session_id}{extension}"
        path.write_bytes(body)
        return str(path)

    def list_sessions(self) -> list[dict]:
        records = []
        for path in sorted(self.runs_dir.glob("session_*.json"), reverse=True):
            records.append(json.loads(path.read_text(encoding="utf-8")))
        return records

    def _write(self, session_id: str, record: dict) -> None:
        (self.runs_dir / f"{session_id}.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
        )


class TrainingHandler(BaseHTTPRequestHandler):
    store: TrainingStore

    def _json(self, status: int, value: object) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(length)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/":
            body = (ROOT / "training_lab.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/sessions":
            self._json(200, {"sessions": self.store.list_sessions()})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/sessions":
            try:
                payload = json.loads(self._body() or b"{}")
            except json.JSONDecodeError:
                self._json(400, {"error": "invalid_json"})
                return
            self._json(201, self.store.create_session(payload))
            return
        if parsed.path.startswith("/api/sessions/") and parsed.path.endswith("/audio"):
            session_id = parsed.path.split("/")[3]
            audio_path = self.store.save_audio(
                session_id,
                self.headers.get("Content-Type", "application/octet-stream"),
                self._body(),
            )
            self._json(201, self.store.update_session(session_id, {"audio_path": audio_path}) or {})
            return
        if parsed.path.startswith("/api/sessions/"):
            session_id = parsed.path.split("/")[3]
            try:
                payload = json.loads(self._body() or b"{}")
            except json.JSONDecodeError:
                self._json(400, {"error": "invalid_json"})
                return
            result = self.store.update_session(session_id, payload)
            self._json(200 if result else 404, result or {"error": "not_found"})
            return
        self._json(404, {"error": "not_found"})

    def log_message(self, format: str, *args: object) -> None:
        return


def serve_training_lab(host: str = "127.0.0.1", port: int = 8765, runs_dir: Path = Path("runs/training")) -> None:
    TrainingHandler.store = TrainingStore(runs_dir)
    server = ThreadingHTTPServer((host, port), TrainingHandler)
    print(f"Continuous Cognitive Engine Lab: http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
