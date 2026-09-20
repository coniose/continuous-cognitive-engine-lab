# Perfil inicial do usuário `dev`

Com os quatro áudios atuais já é possível construir uma primeira camada de
adaptação. Ela ainda não é fine-tuning e não deve ser tratada como uma verdade
definitiva sobre o usuário.

## Evidências disponíveis

- 4 sessões;
- aproximadamente 770 segundos de áudio;
- aproximadamente 1.642 palavras transcritas;
- 95 segmentos de fala;
- probabilidade média de palavra próxima de 0,91;
- transcrição em português com timestamps por palavra.

## O que já podemos usar

### Contexto profissional

O perfil pode priorizar IA aplicada, engenharia, manutenção preditiva,
Forward Deployed Engineering, investigação de problemas e construção de
produtos AI First.

### Vocabulário

O agente já pode receber um glossário com termos como `Forward Deployed
Engineer`, `fine-tuning`, `endpointing`, `VAD`, `DOE`, `vibecoding` e `Meta
Quest 3`.

### Forma de raciocínio observada

O usuário explora ideias longas, cria analogias, conecta carreira e produto,
transfere abstrações entre setores e termina buscando uma arquitetura ou um
próximo experimento.

### Comportamento esperado do assistente

O assistente deve preservar o tema central, resumir a linha de raciocínio,
separar fatos de hipóteses, apontar desvios e gerar perguntas que avancem o
objetivo.

## O que ainda não podemos afirmar

Quatro áudios não bastam para concluir qual é o tom ideal da voz sintética,
qual latência é aceitável ou como o perfil se comporta em atendimento ao
cliente. Também não existe ainda uma referência humana corrigida para medir
WER/CER formal.

## Primeiro produto utilizável

Com estes dados já podemos criar um assistente que:

1. recebe sua fala;
2. transcreve usando o glossário do seu domínio;
3. classifica o assunto e o objetivo;
4. resume a linha de raciocínio;
5. identifica hipóteses e próximos passos;
6. responde usando o contexto profissional do perfil `dev`.

A voz de saída pode ser adicionada como camada independente. O timbre pode ser
testado com uma referência local, mas a adaptação comportamental continuará
vindo do perfil textual e dos feedbacks, não apenas da clonagem vocal.
