from __future__ import annotations

import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path


XR_ROOT = Path(__file__).resolve().parent / "static" / "xr"

# Catálogo lido por agentes (GET /api/xr/lessons) para escolher o que mostrar.
LESSONS = [
    {
        "id": "gradiente",
        "title": "Descida do gradiente",
        "teaches": "Um neurônio tem peso e viés; o erro de cada combinação vira uma "
        "paisagem 3D e aprender é descer esse vale passo a passo.",
        "controls": {
            "play": None,
            "pause": None,
            "step": None,
            "reset": None,
            "lr": [0.1, 0.3, 1, 3, 10, 20, 30],
            "place": "[w, b] com w em [-3, 7] e b em [-5, 5]",
        },
    },
    {
        "id": "camadas",
        "title": "Camadas e XOR",
        "teaches": "Um neurônio só traça uma reta e não resolve o XOR; com uma camada "
        "oculta a rede dobra a superfície de saída até acertar.",
        "controls": {
            "play": None,
            "pause": None,
            "step": None,
            "reset": "semente opcional",
            "mode": ["rede", "neuronio"],
            "input": "[x1, x2] com valores 0 ou 1",
        },
    },
]
LESSON_IDS = {lesson["id"] for lesson in LESSONS}
ACTIONS = {"open_lesson", "caption", "control"}

STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class XRBridge:
    """Fila de comandos agente → óculos e estado óculos → agente.

    O óculos consulta os comandos novos a cada segundo e publica o estado da
    lição aberta; um agente (Claude, CLI, curl) faz o caminho inverso.
    """

    def __init__(self, max_items: int = 200):
        self.lock = threading.Lock()
        self.commands: deque[dict] = deque(maxlen=max_items)
        self.events: deque[dict] = deque(maxlen=max_items)
        self.logs: deque[str] = deque(maxlen=max_items)
        self.latest_id = 0
        self.state: dict = {}

    def push_command(self, payload: dict) -> dict:
        action = payload.get("action")
        if action not in ACTIONS:
            raise ValueError(f"action deve ser uma de {sorted(ACTIONS)}")
        lesson = payload.get("lesson")
        if action == "open_lesson" and lesson not in LESSON_IDS:
            raise ValueError(f"lesson deve ser uma de {sorted(LESSON_IDS)}")
        if action == "control" and (not payload.get("name") or (lesson and lesson not in LESSON_IDS)):
            raise ValueError("control precisa de name (e lesson, se informada, deve existir)")
        if action == "caption" and not str(payload.get("text", "")).strip():
            raise ValueError("caption precisa de text")
        with self.lock:
            self.latest_id += 1
            command = {**payload, "id": self.latest_id, "created_at": utc_now()}
            self.commands.append(command)
            return command

    def commands_after(self, after: int | None) -> dict:
        with self.lock:
            if after is None:
                return {"commands": [], "latest_id": self.latest_id}
            return {
                "commands": [c for c in self.commands if c["id"] > after],
                "latest_id": self.latest_id,
            }

    def update_state(self, payload: dict) -> dict:
        events = payload.pop("eventos", []) or []
        with self.lock:
            self.events.extend(events)
            self.state = {**payload, "updated_at": utc_now()}
            return self.state

    def snapshot(self, event_limit: int = 20) -> dict:
        with self.lock:
            return {**self.state, "eventos_recentes": list(self.events)[-event_limit:]}

    def append_log(self, line: str) -> None:
        with self.lock:
            self.logs.append(f"{utc_now()} {line}")

    def recent_logs(self) -> list[str]:
        with self.lock:
            return list(self.logs)


def resolve_static(path: str) -> Path | None:
    """Mapeia /xr/<arquivo> para static/xr sem permitir sair da pasta."""
    relative = path.removeprefix("/xr").lstrip("/") or "index.html"
    target = (XR_ROOT / relative).resolve()
    if not target.is_relative_to(XR_ROOT) or not target.is_file() or target.suffix not in STATIC_TYPES:
        return None
    return target
