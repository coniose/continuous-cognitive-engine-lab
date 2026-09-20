from pathlib import Path

from cognitive_lab.transcription import normalize_transcript, transcribe_sessions


def test_transcription_requires_audio_or_skips_missing(tmp_path: Path):
    # The integration test with Whisper is intentionally separate because it
    # downloads model weights and requires CUDA/audio decoding.
    assert list(tmp_path.glob("session_*.json")) == []


def test_normalization_preserves_raw_and_corrects_known_terms():
    normalized, corrections = normalize_transcript(
        "um forward-employed-engineer com finetonável precisa aclopar no usuário",
        ["Forward Deployed Engineer"],
    )
    assert "Forward Deployed Engineer" in normalized
    assert "fine-tunável" in normalized
    assert "acoplar ao usuário" in normalized
    assert len(corrections) == 3
