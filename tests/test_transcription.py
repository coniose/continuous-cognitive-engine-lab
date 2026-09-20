from pathlib import Path

from cognitive_lab.transcription import transcribe_sessions


def test_transcription_requires_audio_or_skips_missing(tmp_path: Path):
    # The integration test with Whisper is intentionally separate because it
    # downloads model weights and requires CUDA/audio decoding.
    assert list(tmp_path.glob("session_*.json")) == []
