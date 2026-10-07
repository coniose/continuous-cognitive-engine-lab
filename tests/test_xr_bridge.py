import json
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from cognitive_lab.training_lab import build_server
from cognitive_lab.twin_feed import synthetic_readings
from cognitive_lab.xr_bridge import LESSONS, TwinFeed, XRBridge, resolve_static


def test_commands_are_delivered_once_in_order():
    bridge = XRBridge()
    assert bridge.commands_after(None) == {"commands": [], "latest_id": 0}
    first = bridge.push_command({"action": "open_lesson", "lesson": "camadas"})
    second = bridge.push_command({"action": "caption", "text": "Olha a camada oculta"})
    assert [c["id"] for c in bridge.commands_after(0)["commands"]] == [first["id"], second["id"]]
    assert bridge.commands_after(second["id"])["commands"] == []


def test_new_page_starts_after_backlog():
    bridge = XRBridge()
    bridge.push_command({"action": "open_lesson", "lesson": "gradiente"})
    assert bridge.commands_after(None) == {"commands": [], "latest_id": 1}


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "explode"},
        {"action": "open_lesson", "lesson": "nao_existe"},
        {"action": "caption", "text": "  "},
        {"action": "control"},
        {"action": "guide"},
        {"action": "guide", "step": 0},
        {"action": "guide", "step": True},
        {"action": "guide", "step": "pular"},
    ],
)
def test_invalid_commands_are_rejected(payload):
    with pytest.raises(ValueError):
        XRBridge().push_command(payload)


def test_trail_order_ends_with_learning_after_the_roll():
    ids = [lesson["id"] for lesson in LESSONS]
    assert ids == ["intro", "contar", "tempo", "medir", "neuronio", "rolo", "gradiente", "camadas"]
    for lesson_id in ids:
        assert resolve_static(f"/xr/lessons/{lesson_id}.js") is not None


def test_guide_commands_accept_next_prev_repeat_and_step_number():
    bridge = XRBridge()
    for step in ["next", "prev", "repeat", 3]:
        assert bridge.push_command({"action": "guide", "step": step})["step"] == step


def test_state_keeps_recent_events_for_the_agent():
    bridge = XRBridge()
    bridge.update_state({"licao": "gradiente", "estado": {"erro": 0.9}, "eventos": [{"tipo": "bola_solta"}]})
    bridge.update_state({"licao": "gradiente", "estado": {"erro": 0.5}, "eventos": [{"tipo": "convergiu"}]})
    snapshot = bridge.snapshot()
    assert snapshot["estado"] == {"erro": 0.5}
    assert [e["tipo"] for e in snapshot["eventos_recentes"]] == ["bola_solta", "convergiu"]


def test_static_resolution_stays_inside_xr_folder():
    assert resolve_static("/xr/").name == "index.html"
    assert resolve_static("/xr/lessons/camadas.js").name == "camadas.js"
    assert resolve_static("/xr/../training_lab.py") is None
    assert resolve_static("/xr/../../cognitive_lab/xr_bridge.py") is None


def test_http_roundtrip(tmp_path: Path):
    server = build_server("127.0.0.1", 0, tmp_path)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    def call(path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(base + path, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request) as response:
            return response.status, response.headers.get("Content-Type"), response.read()

    try:
        status, content_type, body = call("/xr/main.js")
        assert status == 200 and content_type.startswith("text/javascript") and b"openLesson" in body
        assert json.loads(call("/api/xr/lessons")[2])["lessons"][0]["id"] == "intro"
        status, _, body = call("/api/xr/commands", {"action": "open_lesson", "lesson": "camadas"})
        assert status == 201 and json.loads(body)["id"] == 1
        assert json.loads(call("/api/xr/commands?after=0")[2])["commands"][0]["lesson"] == "camadas"
        call("/api/xr/state", {"licao": "camadas", "estado": {"epoca": 10}, "eventos": []})
        assert json.loads(call("/api/xr/state")[2])["estado"] == {"epoca": 10}
        with pytest.raises(urllib.error.HTTPError) as error:
            call("/api/xr/commands", {"action": "open_lesson", "lesson": "nao_existe"})
        assert error.value.code == 400
    finally:
        server.shutdown()
        server.server_close()


def test_twin_feed_resets_on_new_swap_and_dedupes():
    feed = TwinFeed()
    troca, readings = synthetic_readings(days=3)
    feed.add({"troca": troca, "readings": readings[:4]})
    result = feed.add({"troca": troca, "readings": readings[2:6]})
    assert result["total"] == 6
    assert [r["ts"] for r in feed.snapshot()["readings"]] == sorted(r["ts"] for r in feed.snapshot()["readings"])
    assert feed.add({"troca": "2026-02-01T00:00:00Z", "readings": []})["total"] == 0


def test_twin_feed_rejects_bad_readings():
    with pytest.raises(ValueError):
        TwinFeed().add({"readings": [{"ts": "ontem", "forca_a": 1, "forca_b": 2}]})
    with pytest.raises(ValueError):
        TwinFeed().add({"readings": [{"ts": "2026-01-01T00:00:00Z", "forca_a": 1}]})


def test_synthetic_cycle_degrades_and_sides_diverge():
    _, readings = synthetic_readings()
    first, last = readings[0], readings[-1]
    assert (first["forca_a"] + first["forca_b"]) / 2 > 1200
    assert (last["forca_a"] + last["forca_b"]) / 2 < 800
    assert abs(last["forca_a"] - last["forca_b"]) > abs(first["forca_a"] - first["forca_b"])
