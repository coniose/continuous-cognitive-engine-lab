from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DOMAIN_GLOSSARIES = {
    "ai_engineering_predictive_maintenance": [
        "Forward Deployed Engineer", "fine-tuning", "fine-tunável", "AI First",
        "LLM", "VAD", "endpointing", "vibecoding", "Meta Quest 3",
        "óculos de realidade aumentada", "manutenção preditiva", "DOE",
        "experimentos de qualidade", "agentes locais", "inferência contínua",
    ],
}


def normalize_transcript(text: str, glossary: list[str]) -> tuple[str, list[dict[str, str]]]:
    """Apply only high-confidence lexical corrections; preserve raw ASR text."""
    replacements = {
        "forward-employed-engineer": "Forward Deployed Engineer",
        "forward deploy and engineer": "Forward Deployed Engineer",
        "forward deployer engineer": "Forward Deployed Engineer",
        "forward deployment engineer": "Forward Deployed Engineer",
        "finitonável": "fine-tunável",
        "finetonável": "fine-tunável",
        "fine tuning": "fine-tuning",
        "aclopar no usuário": "acoplar ao usuário",
        "aclopar": "acoplar",
        "AI first": "AI First",
    }
    normalized = text
    applied = []
    for source, target in replacements.items():
        if source.casefold() in normalized.casefold():
            normalized = normalized.replace(source, target)
            applied.append({"source": source, "target": target})
    return normalized, applied


def transcribe_file(
    audio_path: Path,
    model_size: str = "small",
    language: str = "pt",
    device: str = "cpu",
    compute_type: str = "int8",
    glossary: list[str] | None = None,
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
    glossary = glossary or []
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True,
        condition_on_previous_text=False,
        hotwords=", ".join(glossary),
        initial_prompt="Vocabulário do domínio: " + ", ".join(glossary),
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
    raw_text = " ".join(texts).strip()
    normalized_text, corrections = normalize_transcript(raw_text, glossary)
    return {
        "language": info.language,
        "language_probability": info.language_probability,
        "text": raw_text,
        "normalized_text": normalized_text,
        "lexical_corrections": corrections,
        "glossary": glossary,
        "segments": serialized_segments,
        "model": model_size,
        "backend": backend,
        "vad_filter": True,
    }


def transcribe_sessions(
    runs_dir: Path, model_size: str = "small", only_pending: bool = True
) -> list[dict[str, Any]]:
    results = []
    for session_path in sorted(runs_dir.glob("session_*.json")):
        record = json.loads(session_path.read_text(encoding="utf-8"))
        if only_pending and record.get("transcript_status") == "TRANSCRIBED":
            continue
        audio_path = runs_dir / record["audio_path"].split("runs\\prototype\\", 1)[-1]
        if not audio_path.exists():
            audio_path = Path(record["audio_path"])
        glossary = DOMAIN_GLOSSARIES.get(record.get("niche_profile", ""), [])
        transcript = transcribe_file(audio_path, model_size=model_size, glossary=glossary)
        record["transcript_status"] = "TRANSCRIBED"
        record["transcript"] = transcript
        session_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        results.append(record)
    return results
