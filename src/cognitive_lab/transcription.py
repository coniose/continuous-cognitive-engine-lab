from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def transcribe_file(
    audio_path: Path,
    model_size: str = "small",
    language: str = "pt",
    device: str = "cpu",
    compute_type: str = "int8",
) -> dict[str, Any]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("Instale o suporte de voz com: pip install -e \".[voice]\"") from exc

    backend = device
    try:
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
    except RuntimeError as exc:
        if device != "cuda":
            raise
        # Windows installations may have the model/runtime but not the
        # matching CUDA DLLs. Keep the experiment usable and record the truth.
        backend = "cpu_fallback"
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True,
        condition_on_previous_text=False,
    )
    serialized_segments = []
    texts = []
    for segment in segments:
        text = segment.text.strip()
        texts.append(text)
        serialized_segments.append(
            {
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": text,
                "words": [
                    {
                        "start": round(word.start, 3),
                        "end": round(word.end, 3),
                        "word": word.word,
                        "probability": round(word.probability, 4),
                    }
                    for word in (segment.words or [])
                ],
            }
        )
    return {
        "language": info.language,
        "language_probability": info.language_probability,
        "text": " ".join(texts).strip(),
        "segments": serialized_segments,
        "model": model_size,
        "backend": backend,
        "vad_filter": True,
    }


def transcribe_sessions(runs_dir: Path, model_size: str = "small") -> list[dict[str, Any]]:
    results = []
    for session_path in sorted(runs_dir.glob("session_*.json")):
        record = json.loads(session_path.read_text(encoding="utf-8"))
        audio_path = runs_dir / record["audio_path"].split("runs\\prototype\\", 1)[-1]
        if not audio_path.exists():
            audio_path = Path(record["audio_path"])
        transcript = transcribe_file(audio_path, model_size=model_size)
        record["transcript_status"] = "TRANSCRIBED"
        record["transcript"] = transcript
        session_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        results.append(record)
    return results
