from __future__ import annotations

import json
import random
import time
import urllib.request
from datetime import datetime, timedelta, timezone


def synthetic_readings(seed: int = 14, days: float = 19.0, troca: datetime | None = None) -> tuple[str, list[dict]]:
    """Ciclo sintético de um rolo: teste ~3x/dia, força caindo e lados A/B se afastando."""
    rng = random.Random(seed)
    troca = troca or datetime(2026, 1, 1, tzinfo=timezone.utc)
    readings = []
    t = 4.0
    while t <= days * 24:
        x = t / 24
        if not 6.5 < x < 8.5:  # parada de ~2 dias sem teste
            mean = 1300 - 650 * (x / 19) ** 2.4 + rng.gauss(0, 22)
            delta = 20 + 140 * (x / 19) ** 2 + rng.gauss(0, 10)
            readings.append({
                "ts": (troca + timedelta(hours=t)).isoformat(),
                "forca_a": round(mean + delta / 2, 1),
                "forca_b": round(mean - delta / 2, 1),
            })
        t += 8 + (rng.random() - 0.5) * 3
    return troca.isoformat(), readings


def post_readings(host: str, port: int, payload: dict) -> dict:
    request = urllib.request.Request(
        f"http://{host}:{port}/api/twin/readings",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read())


def simulate(host: str, port: int, interval_s: float = 2.0, seed: int = 14) -> None:
    """Publica uma leitura por vez, como se o teste de qualidade estivesse acontecendo agora."""
    troca, readings = synthetic_readings(seed)
    post_readings(host, port, {"troca": troca, "readings": []})
    for reading in readings:
        result = post_readings(host, port, {"troca": troca, "readings": [reading]})
        print(f"{reading['ts']}  A={reading['forca_a']:7.1f}  B={reading['forca_b']:7.1f}  total={result['total']}", flush=True)
        time.sleep(interval_s)
