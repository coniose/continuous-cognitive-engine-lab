# Gêmeo digital do rolo de selagem (MVP)

Pergunta de partida: quem opera a máquina entende o rolo profundamente, mas não
entende o cálculo. Como usar o **próprio rolo** como representação do cálculo?

## A ideia: cada termo da fórmula vira uma parte física

| No cálculo | No rolo 3D | Origem |
|---|---|---|
| Confiabilidade Weibull `R(t) = exp(−(t/η)^β)` | **Espessura da borracha**: começa cheia (amarela) e afina (roxa) com a idade | **inferido**: só depende da idade |
| Força de selagem dos lados A e B | **Faixa de contato** entre os rolos, metade A e metade B, colorida pela última leitura | **medido**: teste de qualidade destrutivo |
| Histórico das leituras | **O produto saindo da máquina** carrega as leituras como bolinhas; o mais novo fica junto ao rolo | **medido** |
| Força mínima aceitável (ex.: 800) | **Teto de vidro vermelho** sobre o produto: bolinha abaixo dele é teste reprovado | regra |
| `sinal = 0,6·queda_3d/14d + 0,4·perigo_inclinação` | **Neurônio** ao lado: entradas → sinal, com pesos como espessura das conexões | **modelo** |
| `risco = idade + (1 − idade)·sinal·0,65` | Segundo neurônio: idade + sinal → risco | **modelo** |
| Gatilhos (AVISO, RISCO, CONFIRMADO, FIM DE VIDA) | **Andon** (luz) na máquina + faixa com o motivo em português | regra |

A separação **INFERIDO × MEDIDO** é o ponto didático principal. No replay de
exemplo, no dia 17 a Weibull ainda diz que o rolo tem ~55% de chance de estar
bom (borracha ainda grossa), mas as bolinhas já estão encostando no teto
vermelho: o termo medido é o que pega a falha. Ver os dois discordarem é
entender por que o modelo precisa dos dois.

O risco é literalmente um neurônio feito à mão: uma soma ponderada (pesos
0,6 e 0,4), um viés implícito e uma combinação com a idade. A lição 2
(camadas) usa as mesmas cores, então a ponte com "rede neural" é direta: um
modelo treinado aprenderia esses pesos em vez de alguém escolhê-los.

## O que tem no MVP

- Lição `rolo` no XR Lab (`/xr/?licao=rolo`): linha do tempo pegável (arraste e
  o rolo envelhece), play em 0,5–4 dias/s, "rolo novo" e modo **ao vivo**.
- `static/xr/twin.js`: matemática pura (Weibull, janelas 3d/14d, inclinação de
  7 dias por regressão, pior inclinação do ciclo, risco, projeção de 48 h,
  vida restante mediana condicional e gatilhos).
- Replay sintético: teste ~3x/dia, força caindo de ~1300 para ~700, lados A e B
  se afastando com o desgaste e uma parada de 2 dias sem teste.

É uma **reimplementação didática simplificada**, não o motor de produção: não
há cooldown, snooze, filtro de outlier, janela "2 de 5 dias", normalização por
SKU/adesivo nem desconto de horas paradas. Os parâmetros (β=1,5, η=24 d,
limite 800) são **de exemplo**; troque pelos calibrados do seu pipeline em
`DEFAULT_PARAMS`.

## Tempo real

O modo **📡 Ao vivo** consulta `GET /api/twin/readings` a cada 3 s. Qualquer
pipeline publica as leituras assim:

```bash
curl -X POST http://127.0.0.1:8765/api/twin/readings \
  -H "Content-Type: application/json" \
  -d '{"troca": "2026-03-01T06:00:00Z",
       "readings": [{"ts": "2026-03-01T14:00:00Z", "forca_a": 1290, "forca_b": 1270}]}'
```

- `troca` é a data da última troca do rolo; mudar a troca zera o histórico.
- Leituras repetidas (mesmo `ts`) são ignoradas, então dá para reenviar a
  janela inteira a cada execução do job horário.

Simulação sem pipeline (uma leitura a cada 2 s, cada uma ≈ 8 h de processo):

```powershell
python -m cognitive_lab.cli --twin-simulate --twin-interval 2
```

No pipeline real, basta um passo no fim do job horário que leia o `Timestamp`
e as forças A/B do último ciclo e faça esse POST. O gêmeo recalcula tudo no
óculos. Nenhum identificador interno precisa sair do pipeline: só data, força
A e força B.

## Próximos passos

1. **Parâmetros reais no lugar dos de exemplo**: o pipeline publica β, η
   ajustado e limites junto com as leituras.
2. **Paridade com o motor**: rodar o replay de teste do motor de produção
   pelo `twin.js` e comparar os gatilhos, para o gêmeo nunca contar uma
   história diferente da que chega no Teams.
3. **Explicar a contribuição de cada termo** ao tocar no neurônio: "seu risco
   subiu 12 pontos por causa da inclinação".
4. **Voz**: o Claude lê `/api/xr/state` (evento `nivel_mudou`) e narra: "o
   rolo entrou em AVISO porque a força caiu 18% em 3 dias".
5. **Normalização por produto e adesivo** como "lentes": alternar entre força
   bruta e força normalizada e ver as bolinhas subirem ou descerem.
