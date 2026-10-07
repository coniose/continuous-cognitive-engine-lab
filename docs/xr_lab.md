# XR Lab — redes neurais em 3D no Meta Quest

Lições interativas em WebXR para aprender redes neurais com o corpo: apontar,
pinçar, arrastar e ver a matemática responder. Roda no navegador do Quest
(passthrough/AR) e no PC (mouse), servido pelo mesmo servidor do Training Lab.

```text
voz ──► Claude ──► POST /api/xr/commands ──► óculos (consulta a cada 1 s)
                                                │
Claude ◄── GET /api/xr/state ◄── estado + eventos da lição (a cada 1,5 s)
```

## A trilha (capítulos)

Um problema só atravessa a trilha inteira: **qual a chance de um androide
divergir** (quebrar a programação e agir por conta própria)? Personagens
inspirados na ficção de androides em Detroit, 2038 (Kara, Markus, Connor), usados
só como exemplo. A matemática dos androides (`static/xr/deviancy.js`) é
**a mesma do gêmeo do rolo** (`twin.js`), trocando as unidades, para que o
capítulo 5 seja reconhecimento e não novidade.

| # | id | o que você faz | o que aprende | no rolo |
|---|---|---|---|---|
| — | `intro` | Escaneia a Kara, vê o mapa da trilha. | A pergunta: qual a chance de ela divergir? | — |
| 1 | `contar` | Sorteia semanas para 100 androides, troca a chance. | Probabilidade = contagem em muitas repetições. | — |
| 2 | `tempo` | Arrasta os dias, troca β. | Risco que cresce com a idade (Weibull, R(t), η). INFERIDO. | espessura da borracha |
| 3 | `medir` | Roda os scans da Kara e do Markus. | Scans A/B contra o muro vermelho. MEDIDO pega o que a idade não vê. | bolinhas no produto, teto de vidro |
| 4 | `neuronio` | Arrasta idade, queda e inclinação. | A fórmula de risco como um neurônio: pesos × entradas → LED. | neurônio ao lado do rolo, andon |
| 5 | `rolo` | Linha do tempo do rolo, modo ao vivo. | Tudo junto no gêmeo digital. Ver [`gemeo_digital_rolo.md`](gemeo_digital_rolo.md). | — |
| 6 | `gradiente` | Pega a bola na paisagem do erro. | Aprender os pesos descendo o gradiente (ordens contraditórias → divergiu?). | pesos calibrados |
| 7 | `camadas` | Treina rede × 1 neurônio. | Conflito ordem × consciência (XOR) precisa de camada oculta. | — |

Cada capítulo tem um **guia narrado** (painel à esquerda): passos curtos,
lidos em voz alta pelo navegador quando há voz disponível, com **◀ Voltar**,
**🔊 Repetir** e **Próximo ▶**. Alguns passos mexem na cena sozinhos (por
exemplo, levar a linha do tempo até o dia 17). No topo: **◀ ▶** troca de
capítulo, **☰ Capítulos** abre a lista e **🔊 Voz** liga ou desliga a narração.

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
| | | `{"action": "guide", "step": "next"}`: avança o guia narrado (`next`, `prev`, `repeat` ou o número do passo) |
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
