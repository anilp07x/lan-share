# Brag Plan: LAN Share

## What is this app?
Troca de mensagens e ficheiros entre dispositivos da mesma rede local: um PC faz de servidor, qualquer telemóvel abre o URL no browser, escreve um PIN de 6 dígitos e envia ficheiros de até 2 GB **diretamente para o disco do PC** — sem internet, sem contas, sem nuvens, sem cabos.

## The angle
O produto é a *ausência* de tudo: sem cloud, sem login, sem cabo, sem app. O vídeo mostra a coisa a acontecer, não a ser descrita — um terminal imprime um QR, o telemóvel aponta a câmara, o PIN abre o feed, e o ficheiro aparece no disco do PC. A tensão é "espera, isto é mesmo local?" e a resposta é um `npm start`.

Específico ao projecto (nada genérico): terminal real com PIN + QR, ecrã de login real com aurora/glass card e selo de sucesso, feed real com rail de estatísticas e cartões de anexo, drop-zone "Larga aqui os ficheiros", barra de progresso de upload real, e os limites reais do servidor (2 GB, retenção de 24 h).

## Hook (first 2-3 seconds)
Janela de terminal escura. `$ npm start` é escrito carácter a carácter. Sai `── LAN Share ──`, depois `PIN de acesso (mostra aos telemóveis)` com seis dígitos, depois `── Abre a LAN Share noutro telemóvel em: ──` e um QR code desenha-se no terminal. A primeira frase em ecrã (1.6s, no primeiro strong cue):

**"Um comando. Um QR. É só isso."**

O gancho não é uma palavra: é a imagem de um QR code vivo dentro de um terminal.

## Key moments (the middle)
1. **O selo de sucesso do PIN.** Os seis slots do PIN de `Login.tsx` enchem-se um a um (com som de tecla), o contador `1/6 → 6/6` corre, e no sexto dígito o cadeado transforma-se num check desenhado do zero com o anel de gradiente a estalar (`animate-success-pop` + `check-draw`). Em baixo, os selos reais do rodapé: "Sessão encriptada" · "Funciona sem internet". A promessa do ecrã real, sem marketing.
2. **O feed a receber mensagens de outro dispositivo.** Mensagens entram uma a uma (o `Reveal` do `Feed.tsx`), o rail lateral mostra "Ligado" com ponto pulsante e o bloco "Nesta partilha" a contar (mensagens / ficheiros / transferidos). É a prova de "tempo real" sem dizer a palavra.
3. **Um ficheiro de 1,2 GB a atravessar o Wi-Fi.** A drop-zone real do Composer ("Larga aqui os ficheiros") aparece; o ficheiro `Relatório final (v2).pdf` (nome que vem do próprio `PLAN.md`) entra na fila, a barra de progressoenche 0→100% em ~1.6s, e o cartão de anexo aterra no feed. As estatísticas do rail saltam. É o centro do vídeo: a app a fazer a coisa.

## Outro / punchline
Três selos de garantia entram um a um em fila: **100% offline** · **Até 2 GB** · **Expiram em 24 h**. Depois o lockup de marca: símbolo + "LAN Share", e por baixo a frase da app real (do herói de `Login.tsx`), em gradiente de texto:

**"Partilha o que importa, dentro da tua rede."**

Sem CTA, sem "disponível já", sem URL. A frase é o payload.

## User flow worth showing
Três beats, Filmados do produto a funcionar:
1. **Entrada** — o terminal imprime PIN + URL + QR (`server/index.ts`), o telemóvel abre o browser no URL e escreve o PIN de 6 dígitos (`Login.tsx`).
2. **Acção** — no feed, larga-se um ficheiro, ele entra na fila com progresso real de XHR (`Composer.tsx` + `UploadChip.tsx`).
3. **Resultado** — o cartão de anexo aparece no feed com nome, tamanho e tipo, descarregável, e as estatísticas da sessão contam (`Feed.tsx` + `StatusBar.tsx`).

## Tone
- Preset: `app-store`
- Creative direction: filme de produto Apple — um claim por beat, terminal → telemóvel → disco, sem truques e sem piada, mas com o produto a funcionar a sério no ecrã
- Interpretation: liso e preciso. Entradas rápidas (0.3–0.5s), holds longos para ler, transições de slide/wipe limpas de 0.35–0.45s, tipografia em title case com peso médio, zero caps lock, zero confetti. A confiança é o tom, não a excitação.

## Format: landscape — 1920x1080 (30 fps)
## Duration: 23.5 seconds

## Visual identity (from the project)
- Background: `#000000` (dark, `theme_color` do manifesto e `--background` no modo escuro)
- Surface / card: `#1c1c1e` (`--card`)
- Text: `#f5f5f7` (`--foreground`)
- Muted text: `#98989d` (`--muted-foreground`)
- Accent: `#2997ff` (`--primary` dark) — o azul do botão de envio, do anel da marca e do `send`
- Success: `#30d158` (ponto "Ligado", check do PIN, etiqueta de concluído)
- Warning: `#ff9f0a` (estados "a reconectar")
- Border: `#ffffff14` (hairlines de 1px, como nos cards reais)
- Radius: `0.75rem` (cards 12px; o composer é `rounded-2xl`)
- Display font: `system-ui / -apple-system / 'Segoe UI'` — o projecto não usa webfont, e isso é parte da identidade (renderiza em Segoe UI no Chrome do Windows)
- Body font: mesma stack
- Terminal font: monospace do sistema (`ui-monospace, 'Cascadia Mono', Consolas`) — só na Scene 1
- Gradientes a copiar: `brand-ring` (conic-gradient azul→verde à volta do logo), `text-gradient` (foreground→primary no título), `aurora` (radial-gradients suaves azuis/verdes + grelha de 44px mascarada)
- Strongest visual element: o cartão de vidro do login (`.glass-card`, blur 24px + saturate 180%) com o selo de gradiente — é o frame mais bonito do produto e serve de cartaz para o poster.

## Share copy (draft)
LAN Share: o teu PC imprime um QR e o telemóvel passa a enviar ficheiros de até 2 GB direto para o disco.
Sem contas, sem nuvens, sem internet — nada sai de casa.
Node 24 + Fastify + React, LAN-only por conceção.

## Audio direction
- Role: cama musical quente e leve + camada de SFX consistente e discreta (postura `app-store`)
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (warm / business-y, casa com `app-store` e `polished`)
- Music treatment: fade-in de 0.3s no início, volume 0.32 constante, fade-out suave nos últimos 1.2s (22.3→23.5s), sem ducking (não há voz). Batida a 114.84 BPM dá espaço para as revelações sem ficar "corrida".
- Music cue guidance: preset disponível em `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json` (tempo 114.84; strong cues na janela 0–25s: 1.60, 3.70, 5.80, 6.34, 8.96, 9.50, 12.65, 17.91, 22.65, 24.23). Strong cue locks (máx. 3): **3.70s** (QR desenhado), **6.34s** (selo de sucesso do PIN), **21.59s** (frase final do outro). O **17.91s** é o corte de cena 4→5. Beat-grid de 2 em 2 (~1.05s de espaçamento) para os dígitos do PIN, para as mensagens do feed e para os três selos do outro.
- Audio-reactive treatment: subtle; o RMS grave faz a aurora do login respirar e dá presença ao cartão de anexo e ao lockup final. Sem waveform, sem equalizador, sem notas, sem pulso agressivo.
- SFX posture: sparse-but-present (6–8 cues no total), todos entre 0.55 e 0.75 de volume, nada agressivo.
- Audio-coupled moments: digitação do PIN (keypress), envio da mensagem (click), ficheiro a cair na fila (drop), progresso a encher (ticks adelgaçados), aterragem do anexo (soft impact), selo de garantia #1 e lockup da marca (bell).
- Restraint rule: a música nunca sobe acima de 0.35 e nenhum SFX tapa a palavra que está a ser lida; nada de whooshes, nada de riser, nada de glitch.

## Storyboard

### Scene 1 — Terminal + QR — 4.0s [0.00–4.00]
**What's on screen:** Janela de terminal escura (`#0c0c0e`) centrada, com três "botões" de janela em `#2c2c2e`. Dentro: prompt `$ npm start` escrito carácter a carácter (teclas visíveis). Saída a descer linha a linha, cada uma com a cor do logger do Fastify:
- `── LAN Share ──` (info, cinza)
- `PIN de acesso (mostra aos telemóveis)` + seis dígitos (o PIN numérico a standout)
- `── Abre a LAN Share noutro telemóvel em: ──`
- `http://192.168.1.42:3000`
- QR code (matriz de blocos `#f5f5f7`/`#0c0c0e`) que se desenha de cima para baixo, revelando-se
**Copy on screen:** "Um comando. Um QR. É só isso." — entra em 1.60s (strong cue), assenta até 4.00s.
Sequential/interaction: **yes** — escrita do comando (7 caracteres) e revelação linha-a-linha da saída; QR desenhado progressivamente.
Audio intent:dry run de máquina — presença segura, "isto arranca mesmo".
Audio-coupled idea: cada carácter de `npm start` com keypress; a linha do PIN com um tick grave; o QR a desenhar com um som de interface `switch` que sobe com o desenho.
Music: vol-11, mood calmo e seguro, entra em 0.3s.
Transition mood: clean wipe (o terminal sai por baixo, o ecrã de login entra por cima) → Scene 2

### Scene 2 — O selo do PIN — 4.0s [4.00–8.00]
**What's on screen:** O ecrã de login real, reconstruído. Fundo `#000000` com `.aurora` (radiais azuis/verdes) a derivar devagar e `.aurora-grid` (grelha 44px, máscara radial). Cabeçalho: ícone `share` azul + "LAN Share" + badge "Rede local" com ponto verde. Cartão de vidro centrado (`.glass-card`, blur 24px) com:
- selo: anel `brand-ring` cónico, dentro o ícone `lock` azul
- "Bem-vindo de volta" + "Pede o PIN a quem tem a LAN Share aberta neste computador."
- "PIN de 6 dígitos" + contador `0/6`
- seis slots `size-11 rounded-xl` com separador entre o 3.º e o 4.º
- botão "Entrar" (primário, desativado até estar completo)
- rodapé: "Sessão encriptada" · "Funciona sem internet"
**Sequential/interaction:** **yes** — os seis dígitos entram um a um (60ms entre slots, som de tecla, `slot-pop` em cada), o contador acompanha `1/6…6/6`, a dica muda para "PIN completo, a validar…". No sexto dígito: o `lock` é substituído pelo check desenhado (`check-draw`, traço a desenhar-se), o anel dá `success-pop`, um `sheen` varre o cartão, o título passa a "Sessão iniciada" e a legenda a "A abrir o teu espaço partilhado…" (verbo do componente real).
**Timing:** título + slot vazio legíveis de 4.15→5.10; dígitos de 5.10→6.20; **selo de sucesso a 6.34s (strong cue)** e a segurar até 8.00.
Audio intent: confidência — a validação a correr e a aceitar.
Audio-coupled idea: 6 keypress (aleatorizados de `keyboard/keypress-*.wav`, adelgaçados — não todos), um `switch` suave no check desenhado.
Music: vol-11 continua, sem mudança de dinâmica.
Transition mood: clean slide (o cartão encolhe para dentro do ecrã do telemóvel) → Scene 3

### Scene 3 — O feed a acontecer — 4.5s [8.00–12.50]
**What's on screen:** O ecrã real do feed, em moldura de telemóvel à direita (ou centrado, conforme a composição): rail lateral com a marca, badge "Ligado" (ponto verde pulsante) e a dica "Ligação activa. Tudo o que enviares aparece aqui e nos outros dispositivos."; bloco "Nesta partilha" com três `StatRow`s (mensagens / ficheiros / transferidos) com os valores a contar. Coluna principal: separador de dia "HOJE", depois mensagens a entrar uma a uma com o `Reveal` (6px, stagger 15ms):
1. bolha de texto: "Chegou o resto da lista da aula?"
2. bolha de texto: "Tenho. Envio já."
3. cartão de anexo: miniatura + "IMG_2481.jpg" / "4,2 MB · Imagem" + botão de download
**Copy on screen:** "Mensagens em tempo real. Todos na LAN veem tudo." — entra em 9.50s (strong cue), segura até 12.50.
Sequential/interaction: **yes** — 3 mensagens entram uma a uma; contadores do rail saltam (2 mensagens, 1 ficheiro, 4,2 MB).
Audio intent: movimento vivo e leve — o produto a funcionar, sem surprises.
Audio-coupled idea: `interface/drop_*` muito suave por mensagem; um `chip-lay` quando os contadores fecham.
Music: vol-11, mesmo leito.
Transition mood: smooth wipe (a moldura do telemóvel desliza para o canto e o drop-zone expande) → Scene 4

### Scene 4 — 1.2 GB a atravessar o Wi-Fi — 5.41s [12.50–17.91]
**What's on screen:** O drop-zone real do Composer em ecrã inteiro: cartão tracejado a 2px azul, ícone `upload` num quadrado arredondado azul, "Larga aqui os ficheiros" e "Vão entrar na fila de envio." (texto verbatim de `Composer.tsx`). O ficheiro entra na fila: chip com o ícone de PDF, nome **"Relatório final (v2).pdf"**, barra de progresso a encher 0→100%, percentagem a contar. A 100% o chip fica verde e o cartão de anexo aterra no feed ao fundo, com "1.2 GB · PDF" e download. O rail de estatísticas (canto) salta para "3 mensagens · 2 ficheiros · 1.2 GB".
**Copy on screen:** "Até 2 GB por ficheiro — do telemóvel para o disco do PC." — entra em 13.20s, segura até 17.20.
Sequential/interaction: **yes** — drop simulado, chip entra, progresso conta, cartão aterra. Ticks de progresso adelgaçados (não um por frame de progresso).
Audio intent: peso e chegada — o momento mais "físico" do vídeo.
Audio-coupled idea: `interface/drop_001` quando o ficheiro entra na fila; ticks graves a cada ~25% do progresso; o cartão aterra no feed às **17.05s** (leitura até ~17.6) e o **strong cue 17.91s** marca o corte para a cena 5.
Music: vol-11, sem pico — a atenção fica na barra.
Transition mood: clean slide (tudo recolhe para o centro e os selos entram em fila) → Scene 5

### Scene 5 — Três garantias + lockup — 5.59s [17.91–23.50]
**What's on screen:** Fundo `#000000` limpo (a aurora desvanece). Três cards de garantia entram em fila horizontal, um a um:
- **100% offline** — "Nada sai da tua rede local."
- **Até 2 GB** — "Por ficheiro, sem fila."
- **Expiram em 24 h** — "O disco nunca fica cheio."
Depois, o lockup: símbolo de partilha no anel `brand-ring`, "LAN Share" em peso médio e, por baixo, a frase em `text-gradient`:
**"Partilha o que importa, dentro da tua rede."**
**Sequential/interaction:** **yes** — 3 cards a entrar uma a uma (beat-grid de 2 em 2: 18.44, 19.49, 20.54, cada uma a segurar ~0.9s e as três a ficar em ecrã), depois o lockup assenta.
**Timing:** última card assenta às 20.54; anel e símbolo às 21.29–21.35; wordmark às 21.43; regra às 21.49; a frase em `text-gradient` entra no **strong cue 21.59s** e segura até 23.47 (2s de leitura, 7 palavras).
Audio intent: repouso e encerramento limpo.
Audio-coupled idea: `interface/drop_*` por card (o primeiro sincronizado com o beat, os outros dois), um único `impactBell_heavy_000` suave no lockup, música a fechar em fade-out.
Music: vol-11, fade-out de 22.30→23.50.

**Music mood for this video:** clean, quente e seguro (upbeat mas contido) — `app-store` sem euforia.
**Audio summary:** Uma cama de batida leve e quente da primeira à última segundo, seis teclas de PIN, a queda de um ficheiro com a barra a acelerar, três cards e um bell final — tudo abaixo do queixo, a música a fechar em fade-out limpo por baixo do lockup.
