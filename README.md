# Continuous Cognitive Engine Lab

Laboratório público para estudar agentes locais de voz, endpointing,
adaptação por usuário e inferência contínua.

O projeto não é um executor de WhatsApp. Ele pesquisa o comportamento do
assistente antes de qualquer integração operacional.

## Protótipo atual

O Training Lab roda localmente em Python e permite gravar áudio pelo navegador,
encerrar a fala manualmente, separar sessões por usuário e nicho, ajustar
endpointing, salvar metadados localmente e registrar feedback humano.

## XR Lab: redes neurais em 3D

Lições em WebXR para aprender redes neurais com as mãos no Meta Quest (ou com
o mouse no PC): a paisagem 3D do erro com a bola descendo o gradiente e uma
rede em camadas dobrando a própria superfície de saída até resolver o XOR. Um
agente abre lições, narra e lê o que você fez por uma API simples. Detalhes
em [`docs/xr_lab.md`](docs/xr_lab.md).

A terceira lição é um **gêmeo digital de um rolo de selagem**: o rolo vira o
gráfico (borracha = vida Weibull inferida, produto saindo = testes de qualidade
medidos, neurônio = fórmula de risco), em replay ou ao vivo. Ver
[`docs/gemeo_digital_rolo.md`](docs/gemeo_digital_rolo.md).

Com o servidor rodando, abra http://127.0.0.1:8765/xr/.

## Execução

```powershell
python -m venv .venv
.venv\\Scripts\\Activate.ps1
python -m pip install -e ".[dev]"
python -m cognitive_lab.cli
```

Abra http://127.0.0.1:8765/.

## Transcrição local

Depois de instalar o extra de voz, processe as sessões gravadas:

```powershell
python -m pip install -e ".[voice]"
python -m cognitive_lab.cli --transcribe --runs-dir runs/prototype --model-size small
```

O comando preserva os arquivos de áudio e adiciona ao JSON de cada sessão o
texto, segmentos, timestamps por palavra e probabilidades. O primeiro perfil
usa CPU para funcionar sem depender de DLLs CUDA específicas; a camada de
transcrição registra o backend usado para permitir benchmark posterior na GPU.

## Identidade da sessão

```text
user_id          quem está falando
niche_profile    em qual domínio trabalha
culture_context  vocabulário e contexto cultural
career_goal      qual objetivo orienta o assistente
role_profile     comportamento esperado do agente
```

Exemplo inicial: `dev`, `ai_engineering_predictive_maintenance`,
`engineering_experimentation`, `build_local_voice_agents` e
`technical_operator`.

Os áudios reais ficam fora do Git. Este repositório público contém somente
código e dados sintéticos ou anonimizados.

## Roadmap

1. Coleta e calibração de endpointing.
2. Transcrição local e timestamps.
3. Benchmark single-agent versus ensemble.
4. Inferência contínua sobre eventos sintéticos.
5. Augmentation de voz com validação em áudio real reservado.
6. Relatório de qualidade, latência e custo computacional.

Quantidade de áudio sintético não é tratada como informação independente. O
laboratório deve detectar saturação e recomendar novas amostras reais quando o
ganho marginal cair.
