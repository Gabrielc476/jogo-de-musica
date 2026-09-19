# Vinyl Lounge — Documento de Contexto, Mecânicas & Direção de Arte

> **Objetivo deste documento:** Fornecer contexto de produto, psicologia dos jogadores, fluxos de experiência (UX), dinâmicas sociais e diretrizes de identidade visual para desenvolvedores e agentes de IA continuarem a evolução do projeto **Vinyl Lounge**.

---

## 1. Visão do Produto & Filosofia (O "Porquê")

### O Problema dos Jogos Tradicionais de Adivinhar Música
A maioria dos jogos musicais existentes no mercado peca em dois pontos fundamentais:
1. **Bancos de dados estáticos e impessoais:** Perguntas pré-fabricadas com faixas genéricas de rádios corporativas, que perdem a graça rapidamente e não refletem o gosto do grupo.
2. **Isolamento de áudio em mobile:** Forçar cada jogador a ouvir a música pelo próprio alto-falante do celular gera cacofonia, dessincronização por latência de rede e bloqueios constantes de autoplay em navegadores móveis.

### A Proposta do Vinyl Lounge
O **Vinyl Lounge** transforma a resenha entre amigos em uma experiência coletiva e física:
* **Uma única caixinha de som:** Um celular pareado via Bluetooth ao som do ambiente comanda o áudio para toda a sala.
* **Mestre rotativo (O DJ da rodada):** O poder de escolha passa de mão em mão. O jogo ganha personalidade pelas piadas internas, nostalgia de infância e gostos musicais específicos daquele grupo.
* **Letra Sincronizada na Mesa do Mestre:** O Mestre não precisa adivinhar no escuro onde começa o refrão ou a estrofe clássica; ao mover a agulha na linha do tempo, a letra sincronizada daquele segundo surge na tela em tempo real.
* **Aconchego & Sofisticação:** Em vez de uma estética espalhafatosa de quiz infantil, o jogo se passa em um *lounge* escuro e acolhedor de discos de vinil, com iluminação suave e acabamento refinado inspirado no Spotify.

---

## 2. Personas & Cenários de Uso

* **O Churrasco / Resenha em Casa:** 4 a 10 amigos reunidos na sala ou quintal. Uma caixa Bluetooth ligada. As pessoas jogam enquanto conversam, bebem e comemoram quando toca aquele som clássico esquecido.
* **O Grupo Heterogêneo:** Amigos com idades e preferências distintas (do pagode anos 90 ao indie rock). A rotação do Mestre garante que todo mundo tenha seu momento de brilhar e surpreender os outros.
* **O "DJ da Vez" & a Escolha do Trecho:** O Mestre quer escolher a introdução ou o refrão na hora certa. Como o ambiente de festa costuma ser barulhento, a caixa de letra sincronizada permite que ele configure o trecho exato de 15 segundos sem precisar colocar o celular no ouvido.

---

## 3. Dinâmica Social & Mecânicas de Jogo

### 3.1. A Rotação do Mestre (DJ)
* A cada rodada, o papel de Mestre é transferido para o próximo participante na ordem do lobby.
* O Mestre escolhe a música diretamente no catálogo/busca do YouTube e seleciona a janela de início (`offset`) e duração (`10s`, `15s` ou `20s`).
* Acompanha a **letra sincronizada** na tela de corte para calibrar a dificuldade do trecho.
* **Regra de ouro:** O Mestre da rodada não palpita (ele já sabe a resposta). A pontuação dele depende do quão calibrada foi a sua escolha.

### 3.2. O Dilema do Mestre (Game Balance)
Para evitar que o Mestre escolha uma faixa inalcançável (ninguém pontua) ou uma faixa batida demais (todo mundo pontua sem esforço), a pontuação dele é condicionada:
* **0 pontos:** Se ninguém na sala acertar a faixa (escolha impossível / anti-jogo).
* **200 pontos:** Se todo mundo acertar (escolha óbvia demais).
* **500 pontos:** Se houver acertos parciais (pelo menos 1 acerto, mas não todos — indicando um desafio justo e instigante).

### 3.3. Pontuação de Escassez Inversa (Inverse Scarcity)
Quem adivinha faixas difíceis deve ser recompensado proporcionalmente:
* A pontuação base por rodada é calculada por:
  $$\text{Pontos Base} = \left\lfloor \frac{1000}{C_{\text{acertos}}} \right\rfloor$$
* **Exemplos práticos:**
  * Se apenas **1 jogador** acerta uma faixa obscura: ele leva **1000 pontos** sozinho.
  * Se **2 jogadores** acertam: cada um recebe **500 pontos**.
  * Se **5 jogadores** acertam uma faixa muito conhecida: cada um recebe apenas **200 pontos**.

### 3.4. O Bônus de Artista/Banda (+150 pts)
* O objetivo primário é o **Título da Música**.
* Acertar o **Artista/Banda** gera um bônus fixo de **+150 pontos**, mas **apenas se a pessoa também acertou o nome da música**. Isso evita chutes aleatórios em bandas famosas para farmar pontos sem conhecer a faixa.

### 3.5. Tolerância de Digitação Mobile (Fuzzy Match)
Digitar em celulares durante uma contagem regressiva gera erros de digitação comuns:
* **Normalização rigorosa:** Remove acentuação (ç/c, é/e), pontuações, artigos iniciais e parênteses típicos de clipes (ex: `(Official Video)`, `[Ao Vivo]`).
* **Similaridade de Levenshtein:** Tolerância com índice de corte em $\ge 82\%$. Se o jogador digitar "Bohemian Rapsody" ou "Gostava Tanto de Vc", o motor aceita como acerto.

---

## 4. Jornada do Usuário & Fluxo Passo a Passo

```
┌──────────────┐     ┌────────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│ 1. ENTRADA   │ ──► │ 2. CURADORIA   │ ──► │ 3. DISPARO    │ ──► │ 4. ADIVINHAR │ ──► │ 5. REVELAÇÃO │
│ PIN & Caixa  │     │ Mestre + Letra │     │ Botão da Caixa│     │ Vinil + Som  │     │ Capa & Placar│
└──────────────┘     └────────────────┘     └───────────────┘     └──────────────┘     └──────────────┘
```

### Passo 1: Entrada & Atribuição da Caixa
1. O anfitrião cria a sala e recebe um código de 4 caracteres (ex: `8492`).
2. Os jogadores entram informando seus apelidos.
3. Um dos celulares (geralmente conectado ao Bluetooth da caixinha de som) clica na opção **"Conectar como Caixa de Som"**.
4. **Importante:** Esse jogador continua jogando normalmente nas rodadas seguintes!

### Passo 2: Curadoria da Faixa & Leitura do Trecho (Visão do Mestre)
1. O Mestre usa o catálogo ou campo de busca.
2. Ao selecionar uma faixa, abre-se a mesa de ajuste do trecho.
3. O Mestre desliza o controle de tempo (slider) e observa a **caixa de letra sincronizada**, que exibe exatamente qual verso toca naquele segundo (ex: *"Não sei por que você se foi..."*).
4. O Mestre escolhe a duração (`10s`, `15s` ou `20s`) e pode tocar na prévia no fone caso queira conferir o áudio.
5. Clica em **"Soltar Som na Caixinha"**.

### Passo 3: O Disparo Físico (Superando o Autoplay Mobile)
1. O servidor avisa a sala que o som está engatilhado.
2. Na tela do jogador com a **Caixa de Som**, surge o botão destacado: **`[ ▶ Soltar o Som na Caixa ]`**.
3. Ao tocar fisicamente no botão, o IFrame do YouTube dispara o áudio com volume limpo.
4. O servidor recebe a confirmação e inicia imediatamente o cronômetro para todos.

### Passo 4: O Trecho no Ar & Palpites (Visão Geral)
1. O disco de vinil gira na tela com a barra de ondas acústicas em movimento.
2. O cronômetro regressivo marca os 15 segundos restantes.
3. Os jogadores digitam a música e o artista na caixa unificada inferior e enviam o palpite.
4. O jogador da caixinha tem essa mesma tela aberta e também envia seu palpite normalmente.

### Passo 5: Revelação & Placar
1. Acabou o tempo: o vinil para de girar e a capa oficial do álbum se abre.
2. Mostra-se quem acertou a música, quem pegou o bônus de banda e a pontuação calculada.
3. O placar geral é atualizado com animação.
4. O bastão do Mestre é passado automaticamente para o próximo jogador.

---

## 5. Direção de Arte & Identidade Visual

### 5.1. O Conceito: "Spotify Dark Lounge"
A identidade visual deve transmitir a sensação de sentar em uma poltrona de couro em uma loja de discos no fim da tarde, com pouca luz e foco na música.

### 5.2. O que EVITAR (Erros e Vícios de Telas de IA)
* ❌ **Degradês coloridos em tudo:** Evitar botões arco-íris, bordas neon em múltiplos tons e cartões com gradientes roxo-rosa genéricos.
* ❌ **Poluição de Emojis:** Não encher cada título e botão de emojis infantis (`🎵`, `🎸`, `👑`, `✨`). A estética deve ser madura, elegante e moderna.
* ❌ **Tags e Badges redundantes:** Evitar encher a tela com etiquetas como "Áudio Oficial", "33 ⅓ RPM", "Super Bônus", "HD".
* ❌ **Fundos com grelhas/grids artificiais:** Nada de linhas quadriculadas de ficção científica.

### 5.3. O que ADOTAR (Diretrizes Oficiais de Design)
* ✅ **Paleta de Cor Sóbria:**
  * Fundo primário: `#0a0a0d` (preto profundo).
  * Superfícies e cartões: `#121212`, `#181818` e `#242424`.
  * Luz ambiente: Gradientes radiais ultra-suaves simulando abajures âmbar e verde esmeralda.
  * Destaques de ação: Branco puro (`#ffffff`) para contraste limpo e Verde Spotify (`#1ed760`) para confirmações de áudio e play.
* ✅ **Tipografia com Personalidade:**
  * **Outfit:** Fonte geométrica sem serifa com curvaturas modernas (similar à *Spotify Circular*). Usada em títulos, botões e nomes de faixas.
  * **JetBrains Mono:** Usada pontualmente para códigos de sala, cronômetros (`00:14`) e marcadores de tempo (`04:22`).
* ✅ **Vinil Autêntico:**
  * Disco preto com ranhuras em opacidade sutil, reflexo de luz acetinado e selo central sóbrio em tom bordô/vinho (`#831843`).
* ✅ **Pílulas de Filtro Modernas:**
  * Pílulas sólidas em `#242424` com texto claro; pílula selecionada em branco sólido com tipografia preta (`bg-white text-black`).
* ✅ **Caixa de Letra do Trecho:**
  * Painel escurecido em `#121212` com borda sutil, texto em itálico de tom claro e indicador de sincronia em verde esmeralda.

---

## 6. Diretrizes de Ergonomia Mobile (Mobile-First)

1. **Agrupamento no Terço Inferior:**
   * Os campos de digitação (`Qual é a música?` e `Artista ou Banda`) e o botão de envio devem sempre ficar agrupados na base da tela para acesso imediato com o polegar.
2. **Prevenção de Zoom no iOS Safari:**
   * O tamanho computado da fonte de todos os inputs deve ser de **no mínimo 16px** (`text-base` ou `text-sm` com 16px declarados). Se for menor que 16px, o iOS dá zoom automático e quebra o layout.
3. **Viewport Dinâmico:**
   * Usar classes baseadas em `min-h-[100dvh]` em vez de `100vh`, garantindo que a barra de navegação retrátil dos celulares não corte botões nem esconda o rodapé.
4. **Desativação de Corretores Inoportunos:**
   * Sempre incluir `autocomplete="off"`, `autocorrect="off"` e `spellcheck="false"` nos campos de palpite para que o teclado não tente "corrigir" nomes de bandas ou títulos em inglês.

---

## 7. Instruções para Agentes de Código

Ao implementar ou estender o código a partir deste contexto e da especificação técnica (`SPECIFICATION.md`):

1. **Priorize a Resiliência de Áudio:** O botão de "Soltar o Som na Caixa" é inegociável em dispositivos móveis. Nunca tente automatizar o play de volta para WebSockets assíncronos sem interação física prévia.
2. **Conserve a Limpeza Visual:** Respeite a estética Spotify minimalista; evite reintroduzir elementos decorativos excessivos.
3. **Mantenha os Contratos Tipados:** Sempre referencie os tipos TypeScript definidos em `types/game.ts` para sincronizar os payloads entre cliente e servidor.
4. **Integração de Letras:** Conecte o módulo de busca ao serviço de letras sincronizadas (LRCLIB), enviando as linhas parseadas para a régua de tempo do Mestre.