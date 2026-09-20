# Baseline do usuário `dev`

## Escopo

Quatro gravações foram coletadas no perfil `dev`, no nicho
`ai_engineering_predictive_maintenance`, com o papel `technical_operator`.

Duração total aproximada: 12 minutos e 50 segundos.

Este relatório não é uma medição formal de acurácia, porque ainda não existe
uma transcrição de referência revisada palavra por palavra. É uma análise
inicial de cobertura semântica e de erros evidentes do ASR.

## Temas recuperados

- agente de voz local adaptado ao usuário;
- Forward Deployed Engineer como profissional multissetorial;
- abstração e modularização de problemas;
- óculos de realidade aumentada e Meta Quest 3;
- entrada por voz e saída visual;
- captura contextual de ambiente, fala e situação;
- geração de perguntas assertivas para progredir uma investigação;
- IA First, fine-tuning e feedback humano;
- integração futura com hardware vestível.

## Erros evidentes do ASR

| Forma reconhecida | Forma esperada | Tipo |
|---|---|---|
| forward-employed-engineer | Forward Deployed Engineer | termo composto |
| forward deploy and engineer | Forward Deployed Engineer | termo composto |
| finetonável | fine-tunável | termo técnico |
| aclopar | acoplar | lexical |
| pre-contestualização | pré-contextualização | lexical |
| nota forma | plataforma | lexical/contextual |

Esses erros justificam um glossário por nicho, mas não justificam fine-tuning
ainda. Primeiro devemos medir quantas correções o glossário resolve sem alterar
o significado.

## Hipótese comportamental inicial

O assistente para este usuário deve priorizar:

1. síntese de ideias longas e não lineares;
2. preservação de termos técnicos e nomes próprios;
3. identificação de objetivo, contexto, evidência e próxima pergunta;
4. distinção entre hipótese, decisão e exploração;
5. feedback explícito quando a resposta fugir do tema ou alucinar;
6. adaptação para ambientes técnicos, industriais e de produto.

## Métrica inicial

Para cada áudio, registrar:

```text
WER/CER: somente após revisão humana da referência
term_accuracy: termos do glossário reconhecidos corretamente
semantic_coverage: objetivos e entidades recuperados
hallucination_rate: conteúdo atribuído ao áudio sem evidência
normalization_precision: correções corretas / correções aplicadas
```

O primeiro teste prático deve revisar manualmente 20 trechos selecionados pelo
menor nível de confiança e pelos termos do glossário. O conjunto corrigido será
a primeira referência de avaliação do usuário `dev`.
