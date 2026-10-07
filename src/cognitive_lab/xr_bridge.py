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
    {
        "id": "rolo",
        "title": "Gêmeo do rolo",
        "teaches": "Gêmeo digital de um rolo de selagem: a borracha encolhe com a "
        "confiabilidade Weibull (inferida pela idade), as leituras do teste de "
        "qualidade aparecem no produto saindo da máquina e a fórmula de risco é "
        "mostrada como um neurônio.",
        "controls": {
            "play": None,
            "pause": None,
            "time": "idade do rolo em dias",
            "speed": [0.5, 1, 2, 4],
            "live": [True, False],
            "swap": None,
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


class TwinFeed:
    """Leituras reais (ou simuladas) do teste de qualidade para o modo ao vivo.

    Um pipeline externo publica a data da troca do rolo e as leituras de força
    dos lados A e B; a cena do gêmeo consulta e recalcula o risco no óculos.
    """

    def __init__(self, max_readings: int = 2000):
        self.lock = threading.Lock()
        self.troca: str | None = None
        self.readings: deque[dict] = deque(maxlen=max_readings)

    def add(self, payload: dict) -> dict:
        troca = payload.get("troca")
        readings = payload.get("readings", [])
        if not isinstance(readings, list):
            raise ValueError("readings deve ser uma lista")
        clean = []
        for item in readings:
            try:
                clean.append({
                    "ts": _iso(item["ts"]),
                    "forca_a": float(item["forca_a"]),
                    "forca_b": float(item["forca_b"]),
                })
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"leitura inválida {item!r}: precisa de ts ISO, forca_a e forca_b") from error
        with self.lock:
            if troca is not None:
                troca = _iso(troca)
                if troca != self.troca:
                    self.readings.clear()
                self.troca = troca
            known = {r["ts"] for r in self.readings}
            self.readings.extend(sorted((r for r in clean if r["ts"] not in known), key=lambda r: r["ts"]))
            return {"troca": self.troca, "total": len(self.readings), "adicionadas": len(clean)}

    def snapshot(self) -> dict:
        with self.lock:
            return {"troca": self.troca, "readings": list(self.readings)}


def _iso(value: object) -> str:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def resolve_static(path: str) -> Path | None:
    """Mapeia /xr/<arquivo> para static/xr sem permitir sair da pasta."""
    relative = path.removeprefix("/xr").lstrip("/") or "index.html"
    target = (XR_ROOT / relative).resolve()
    if not target.is_relative_to(XR_ROOT) or not target.is_file() or target.suffix not in STATIC_TYPES:
        return None
    return target
