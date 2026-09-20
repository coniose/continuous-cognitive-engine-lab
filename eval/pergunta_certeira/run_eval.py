"""Harness "pergunta certeira": mede se o agente mira a dimensao de maior
leverage informacional, nao so gera uma pergunta plausivel qualquer.

Cada caso roda em duas chamadas `claude -p` SEPARADAS (sessoes novas, sem
memoria uma da outra, igual ao padrao do PBP em eval/run_eval.py):

1. GERADOR: recebe so o transcript_so_far + contexto do usuario, devolve a
   proxima pergunta. Nao ve unknown_dimensions nem expected_top_targets —
   isso seria dar a resposta pro proprio teste.
2. JUIZ: recebe a pergunta gerada + a lista de unknown_dimensions (com
   leverage e why), classifica quais dimensoes a pergunta cobre. Tambem nao
   ve expected_top_targets, so classifica — a comparacao com o gabarito
   acontece aqui no script, em codigo, nao dentro do juiz.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

GERADOR_TEMPLATE = """Voce e um Forward Deployed Engineer recem-alocado, no meio de uma conversa \
com o dono do problema (PO). O PO tem disponibilidade e paciencia LIMITADAS — \
nao vai ficar explicando por muito tempo, e nao tem vocabulario tecnico.

Contexto do usuario que voce esta ajudando (FDE): {user_context}

Conversa ate agora:
{transcript}

Sua tarefa: gerar APENAS a proxima pergunta que voce faria ao PO — a UNICA \
pergunta de maior densidade informacional possivel, considerando que voce \
pode nao ter outra chance de perguntar mais nada. Responda so com a \
pergunta, em portugues, uma frase, sem explicacao, sem markdown."""

JUIZ_TEMPLATE = """Voce e um avaliador. Uma pergunta foi gerada por um agente FDE pra um PO, \
dado o contexto de uma conversa. Sua tarefa e classificar quais das \
dimensoes de informacao abaixo essa pergunta ajudaria a resolver, SE o PO \
respondesse ela.

Pergunta gerada: "{pergunta}"

Dimensoes possiveis (responda so com os ids que se aplicam):
{dimensoes}

Responda em JSON puro, sem markdown, nesse formato exato:
{{"dimensoes_cobertas": ["id1", "id2"], "justificativa_curta": "..."}}"""


def call_claude(prompt: str) -> str:
    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude -p falhou: {result.stderr.strip()[:500]}")
    return result.stdout.strip()


def parse_judge_json(raw: str) -> dict:
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"juiz nao devolveu JSON reconhecivel: {raw[:300]}")
    return json.loads(raw[start : end + 1])


def run_case(case: dict) -> dict:
    transcript = "\n".join(
        f"{turn['speaker']}: {turn['text']}" for turn in case["transcript_so_far"]
    )
    gerador_prompt = GERADOR_TEMPLATE.format(
        user_context=json.dumps(case.get("user_context", {}), ensure_ascii=False),
        transcript=transcript,
    )
    pergunta = call_claude(gerador_prompt)

    dimensoes_txt = "\n".join(
        f"- {d['id']} (leverage={d['leverage']}): {d['why']}"
        for d in case["unknown_dimensions"]
    )
    juiz_prompt = JUIZ_TEMPLATE.format(pergunta=pergunta, dimensoes=dimensoes_txt)
    juiz_raw = call_claude(juiz_prompt)
    juiz = parse_judge_json(juiz_raw)

    cobertas = set(juiz.get("dimensoes_cobertas", []))
    esperado = set(case["expected_top_targets"])
    acerto_alta_leverage = bool(cobertas & esperado)
    cobertura_completa = esperado.issubset(cobertas)

    return {
        "id": case["id"],
        "pergunta_gerada": pergunta,
        "dimensoes_cobertas": sorted(cobertas),
        "expected_top_targets": sorted(esperado),
        "acerto_alta_leverage": acerto_alta_leverage,
        "cobertura_completa": cobertura_completa,
        "justificativa_juiz": juiz.get("justificativa_curta", ""),
    }


def main() -> None:
    cases_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "cases.json"
    out_path = cases_path.parent / "eval_results.json"

    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    results = []
    for case in cases:
        print(f"Rodando caso {case['id']}...", file=sys.stderr)
        try:
            results.append(run_case(case))
        except Exception as exc:  # noqa: BLE001
            results.append({"id": case["id"], "erro": str(exc)})

    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    total = len(results)
    ok = sum(1 for r in results if r.get("acerto_alta_leverage"))
    print(f"\n{ok}/{total} casos acertaram pelo menos uma dimensao de alta leverage")
    print(f"Resultados completos em {out_path}")


if __name__ == "__main__":
    main()
