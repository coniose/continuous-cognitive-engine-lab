# XR Lab — redes neurais em 3D no Meta Quest

Lições interativas em WebXR para aprender redes neurais com o corpo: apontar,
pinçar, arrastar e ver a matemática responder. Roda no navegador do Quest
(passthrough/AR) e no PC (mouse), servido pelo mesmo servidor do Training Lab.

```text
voz ──► Claude ──► POST /api/xr/commands ──► óculos (consulta a cada 1 s)
                                                │
Claude ◄── GET /api/xr/state ◄── estado + eventos da lição (a cada 1,5 s)
```

## Lições

| id | o que você faz | o que aprende |
|---|---|---|
| `gradiente` | Pega a bola na paisagem do erro, solta e vê ela descer. Muda a taxa de aprendizado. | Um neurônio tem peso `w` e viés `b`; cada par tem um erro; aprender é descer o vale contra o gradiente. Taxa alta demais faz a bola pular de um lado para o outro. |
| `rolo` | Arrasta a linha do tempo de um rolo de selagem, liga o modo ao vivo. | Gêmeo digital: a borracha afina com a confiabilidade Weibull (inferida), as leituras do teste de qualidade saem no produto (medidas) e a fórmula de risco aparece como um neurônio. Ver [`gemeo_digital_rolo.md`](gemeo_digital_rolo.md). |
| `camadas` | Toca nas entradas `x1`/`x2`, treina a rede e alterna para "1 neurônio". | Um neurônio só inclina um plano e empaca em 0,5 no XOR; com uma camada oculta, a superfície de saída se dobra até acertar os quatro casos. |

Convenção visual: **roxo = 0, amarelo = 1** em todas as lições; pesos
**azuis são positivos**, **laranja são negativos** e a espessura mostra a força.

A matemática (`static/xr/nn.js`) é a mesma do exemplo em NumPy: sigmoid,
entropia cruzada e gradiente descendente em lote, escrita à mão para poder
ser inspecionada e mostrada passo a passo.

## Rodar no PC

```powershell
python -m cognitive_lab.cli
```

Abra http://127.0.0.1:8765/xr/ (ou `/xr/?licao=camadas`).

## Rodar no Quest

WebXR exige contexto seguro (HTTPS ou `localhost`). Três caminhos, do mais
simples ao mais robusto:

1. **Termux no Quest** (como o protótipo do cubo do `quest3-claude-ops`):
   copie o repositório para o Termux, rode `python -m cognitive_lab.cli` lá e
   abra `http://localhost:8765/xr/` no Quest Browser.
2. **`adb reverse`** com o Quest no cabo/modo desenvolvedor: servidor no PC,
   `adb reverse tcp:8765 tcp:8765` e o Quest abre `http://localhost:8765/xr/`.
3. **Túnel HTTPS** (Caminho A do `PLANO_escala.md`): servidor no PC,
   `cloudflared tunnel --url http://127.0.0.1:8765` e o Quest abre o link
   `https://…/xr/`. Atenção: quem tiver o link consegue mandar comandos.

Dentro do óculos: **START AR**, aponte com o controle ou a mão, gatilho/pinça
para apertar. O botão **📍 Trazer para frente** reposiciona o palco.

Não existe DevTools no Quest: a página manda os próprios logs e erros para
`GET /api/xr/log`.

## API para agentes

| método | rota | uso |
|---|---|---|
| GET | `/api/xr/lessons` | catálogo: id, o que ensina, controles aceitos |
| POST | `/api/xr/commands` | `{"action": "open_lesson", "lesson": "camadas"}` |
| | | `{"action": "caption", "text": "…", "speak": true}`: legenda no óculos, falada com a voz do navegador quando disponível |
| | | `{"action": "control", "name": "play", "lesson": "gradiente"}`: `play`, `pause`, `step`, `reset`, `lr`, `place`, `mode`, `input` (veja o catálogo) |
| GET | `/api/xr/state` | lição aberta, estado (erro, pesos, épocas, previsões) e eventos recentes (`bola_solta`, `convergiu`, `empacou`, `entrada_alterada`…) |
| GET | `/api/xr/log` | logs do navegador do óculos |
| GET/POST | `/api/twin/readings` | leituras do teste de qualidade para o gêmeo do rolo (modo ao vivo) |

Pela linha de comando:

```powershell
python -m cognitive_lab.cli --show-lesson camadas --say "Toque em x1 e veja o sinal atravessar as camadas"
```

Uma sessão do Claude Code no PC já consegue conduzir a aula hoje: ela lê
`/api/xr/state` para saber o que você fez (por exemplo, "a bola parou em
w=1,9 com erro 0,46") e responde com `caption` e `control`.

## Próximos passos

1. **Servidor MCP** com as ferramentas `open_lesson`, `say`, `control` e `get_state`
   por cima desta API, para qualquer cliente Claude usar sem curl.
2. **Loop de voz contínuo**: microfone do Training Lab → transcrição local
   (`transcription.py`) → Claude com ferramentas → `caption` + TTS no óculos.
   É o "Continuous Cognitive Engine" aplicado a ensinar.
3. **Gerador de lições**: hoje cada lição é um módulo JS escrito à mão. O
   passo seguinte é uma lição descrita por dados (superfícies, grafos e
   controles) que o Claude monta na hora a partir de uma pergunta.
4. Mais lições: função de ativação (arrastar `z` e ver `σ(z)`), backpropagation
   passo a passo (o erro voltando camada por camada) e overfitting.
