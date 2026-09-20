# Harness "pergunta certeira"

Testa a hipótese central do produto: dado um PO com disponibilidade limitada
(tempo, paciência, vocabulário técnico), o agente consegue identificar e
fazer a pergunta de maior densidade informacional em vez de uma pergunta
genérica ou de baixo valor?

Segue o mesmo padrão de `eval/` do `higames-atendimento` (PBP): casos
held-out com rubrica definida ANTES de rodar, script que chama `claude -p`
pra gerar a resposta, e um segundo `claude -p` como juiz pra pontuar contra
a rubrica — porque "essa é a pergunta certa?" não é regex-verificável como
"a resposta contém o procedimento certo?" era no PBP.

## Formato de um caso (`cases.json`)

- `transcript_so_far`: a conversa até agora (PO fala pouco, informação vaga
  de propósito — é o cenário real).
- `unknown_dimensions`: as variáveis que ainda faltam saber, cada uma com
  `leverage` (alta/media/baixa) e `why` — isso é curado por humano
  (Julio), igual ao `eval/eval_cases.json` do PBP ser escrito antes de rodar.
- `expected_top_targets`: quais dimensões uma pergunta boa deveria mirar.
  Uma pergunta que cobre 2 dimensões de alta leverage ao mesmo tempo pontua
  mais que uma de dimensão única — é o "máximo de informação até o limite
  de disponibilidade do PO" na prática.

## Rodar

```bash
python eval/pergunta_certeira/run_eval.py eval/pergunta_certeira/cases.json
```

## O que isso NÃO é

Não é o modelo final do produto — é o jeito de medir se uma mudança de
prompt/contexto melhora ou piora a qualidade da pergunta, com número, não
com impressão. Primeira leva de casos é sintética (`goteira-teto-001`);
depois da sessão real com a mãe do Julio como PO, a transcrição real vira
caso novo — held-out, não usado pra desenhar o prompt.
