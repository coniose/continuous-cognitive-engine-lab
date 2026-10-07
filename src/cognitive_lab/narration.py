"""Gera a narração em áudio dos guias do XR Lab.

O navegador do Quest não tem síntese de voz (speechSynthesis), então cada
passo dos guias vira um MP3 gerado antes, no PC. O nome do arquivo é o hash
FNV-1a do texto (o mesmo que `main.js` calcula), então mudar um texto gera um
arquivo novo e os antigos podem ser apagados sem medo.

    python -m cognitive_lab.narration            # gera só o que falta
    python -m cognitive_lab.narration --voz pt-BR-AntonioNeural --refazer

Depende de `edge-tts` (pip install edge-tts), que usa o serviço de voz
online do Microsoft Edge: os textos dos guias saem da máquina. Os MP3 ficam
fora do git (`static/xr/narracao/`); copie a pasta para onde o servidor roda.
"""

from __future__ import annotations

import argparse
import asyncio
import re
from pathlib import Path

from .xr_bridge import XR_ROOT

LESSONS_DIR = XR_ROOT / "lessons"
OUTPUT_DIR = XR_ROOT / "narracao"
DEFAULT_VOICE = "pt-BR-FranciscaNeural"

STEPS_BLOCK = re.compile(r"\n  steps: \[\n(.*?)\n  \],\n", re.DOTALL)
STEP_TEXT = re.compile(r"\{ text: '((?:[^'\\]|\\.)*)'")


def fnv1a(text: str) -> str:
    """Hash FNV-1a de 32 bits sobre os bytes UTF-8 (igual ao de main.js)."""
    h = 0x811C9DC5
    for byte in text.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def guide_texts(lessons_dir: Path = LESSONS_DIR) -> list[str]:
    """Textos dos passos (`steps: [{ text: '…' }]`) de todas as lições."""
    texts = []
    for path in sorted(lessons_dir.glob("*.js")):
        block = STEPS_BLOCK.search(path.read_text(encoding="utf-8"))
        if block:
            texts += [m.group(1).replace("\\'", "'") for m in STEP_TEXT.finditer(block.group(1))]
    return texts


async def synthesize(texts: list[str], voice: str, output_dir: Path, redo: bool) -> list[Path]:
    import edge_tts

    output_dir.mkdir(parents=True, exist_ok=True)
    made = []
    for text in texts:
        target = output_dir / f"{fnv1a(text)}.mp3"
        if target.exists() and not redo:
            continue
        await edge_tts.Communicate(text, voice).save(str(target))
        made.append(target)
        print(f"{target.name}  {text[:70]}…")
    return made


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--voz", default=DEFAULT_VOICE)
    parser.add_argument("--refazer", action="store_true", help="gera de novo mesmo os que já existem")
    args = parser.parse_args()
    texts = guide_texts()
    made = asyncio.run(synthesize(texts, args.voz, OUTPUT_DIR, args.refazer))
    keep = {f"{fnv1a(t)}.mp3" for t in texts}
    stale = [p for p in OUTPUT_DIR.glob("*.mp3") if p.name not in keep]
    for path in stale:
        path.unlink()
    print(f"{len(texts)} passos · {len(made)} gerados · {len(stale)} antigos apagados → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
