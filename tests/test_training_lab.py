from pathlib import Path

from cognitive_lab.training_lab import TrainingStore


def test_sessions_are_scoped_by_user_and_niche(tmp_path: Path):
    store = TrainingStore(tmp_path)
    session = store.create_session(
        {
            "user_id": "dev",
            "niche_profile": "ai_engineering_predictive_maintenance",
            "career_goal": "build_local_voice_agents",
            "culture_context": "engineering_experimentation",
            "manual_end": True,
        }
    )
    assert session["user_id"] == "dev"
    assert session["niche_profile"] == "ai_engineering_predictive_maintenance"
    assert store.list_sessions()[0]["career_goal"] == "build_local_voice_agents"
