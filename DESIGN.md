---
name: LAN Share
description: Correio pneumático para a rede local — cada envio é uma cápsula com guia de expedição.
colors:
  shell: "#16302a"
  shell-raised: "#1f3d36"
  shell-foreground: "#eef3ee"
  shell-muted: "#a3b8af"
  signal: "#ff8a1f"
  signal-foreground: "#1d0e00"
  signal-ink: "#a84a00"
  signal-wash: "#ffe7cf"
  concrete: "#e9ece7"
  card: "#fafbf8"
  muted: "#dfe3dc"
  ink: "#13201b"
  ink-muted: "#51605a"
  brass: "#8f6c3a"
  success: "#17803d"
  warning: "#9a5b00"
  destructive: "#c4161c"
  shell-dark: "#0f1d19"
  concrete-dark: "#0a1210"
  card-dark: "#121e1a"
  signal-dark: "#ff9a3c"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  tag:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.045em"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  capsule: "16px"
  composer: "22px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.signal-foreground}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "44px"
  filter-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.concrete}"
    typography: "{typography.tag}"
    height: "40px"
  capsule-tag-mine:
    backgroundColor: "{colors.signal-wash}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.tag}"
  capsule-tag-other:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.tag}"
  rail:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-foreground}"
    width: "288px"
---

# Design System: LAN Share

## Overview

Correio pneumático numa rede local. A app é uma ferramenta (modo Operate): o casco esmalte verde-tubo enquadra o trabalho, o chão de betão claro (ou verde-negro no escuro) deixa as cápsulas lerem-se, e o âmbar de sinal marca o que é acionável e o que é meu. O mundo entra só por paleta, tipografia, densidade e uma assinatura: a guia de expedição de cada cápsula.

Claro e escuro seguem o sistema; os tokens vivem em `client/src/styles.css` (`:root` e `@media (prefers-color-scheme: dark)`).

## Colors

### Primary
- **Sinal âmbar** (`signal`, `--primary`): botão de enviar, ações primárias, ponto e guia das minhas cápsulas, novidades. Texto sobre âmbar é sempre `signal-foreground` (quase preto).
- **Tinta âmbar** (`signal-ink`): o âmbar quando é texto (links, nome na minha guia) — o âmbar puro não tem contraste sobre claro.

### Secondary
- **Casco esmalte** (`shell`): rail desktop, cabeçalho telemóvel, login, ecrã de carregamento, toasts, painel do QR. Texto `shell-foreground`; secundário `shell-muted`.

### Neutral
- **Betão** (`concrete`) é o chão; **cartão** (`card`) as cápsulas e o compositor; `muted` as guias alheias e fundos de ícone; `ink`/`ink-muted` o texto.
- **Esmaltes de remetente**: oito cores fixas (`senderHue` em `client/src/lib/device.ts`) para o ponto de cada dispositivo. Nunca âmbar — âmbar é "eu".

### Named Rules
- **Âmbar é meu e acionável.** Não usar âmbar como decoração nem para estados de erro.
- **Verde-tubo é estrutura.** O casco nunca leva conteúdo do feed.

## Typography

Uma só família: **Archivo** variável (eixos de peso e largura), empacotada no bundle via `@fontsource-variable/archivo` — a app funciona offline.

### Hierarchy
- **display** (`.display`): largura 72%, peso 800. Marca, títulos de diálogo, estados vazios.
- **tag** (`.tag`): largura 70%, peso 600, maiúsculas, `letter-spacing: .045em`, números tabulares. Guias de cápsula, separadores, contagens, rótulos.
- **body**: largura normal, 16.5px / 1.625 no conteúdo das cápsulas; 15px no restante.

## Layout

- Telemóvel: cabeçalho casco (marca · estado + estações + QR · sair), barra de filtros fixa, feed, compositor fixo em baixo com `safe-area-inset`.
- Desktop (`md`, 768px+): rail casco de 288px (marca, estado, estações ligadas, ligar dispositivo, este dispositivo, sair) + coluna `max-w-3xl` centrada.
- Cápsulas minhas alinham à direita; alheias à esquerda; largura máx. 34rem.
- Diálogos são folhas inferiores no telemóvel e centrados a partir de `sm`.

## Elevation & Depth

Plano por defeito; profundidade só onde há sobreposição real: compositor (`0 8px 24px -16px`), botão "envios novos" e toasts (`0 12px 32px -12px`), diálogos (`0 24px 60px -20px`). Overlay dos diálogos: verde-negro a 70% com desfoque de 3px.

## Shapes

Cantos de cápsula: 16px nas cápsulas, 22px no compositor, 14px em botões, pílula nos filtros e no chip de estado. A guia separa-se do conteúdo por uma **linha picotada** (`.perforated`, traço de 3px a cada 6px).

## Components

### Buttons
Primário âmbar 44px; outline em cartão com borda `input`; ghost para ações secundárias. `active:scale(.97)`. Foco: contorno 2px `ring` com 2px de afastamento.

### Chips
Filtros `Tudo / Texto / Ficheiros / Imagens` com contagem tabular; ativo em tinta cheia (`ink` sobre `concrete`).

### Cards / Containers
**Cápsula** (`MessageItem`): guia (ponto do remetente · nome · hora · copiar) + linha picotada + conteúdo (texto com links, ou ficheiro com pré-visualização, ficha `tamanho · tipo · expira em X` e botão de descarga em tinta cheia).

### Signature motion
- Envio: a cápsula sobe (`capsule-out`, 0.5s, ease-out-expo) e o ícone de enviar "dispara" (`launch`).
- Chegada: a cápsula cai do tubo (`capsule-in`) e a guia pisca em âmbar (`tag-flash`).
- `prefers-reduced-motion`: sem deslocamentos; o flash da guia mantém-se como sinal de chegada.

## Do's and Don'ts

- **Do** pôr o nome do remetente e a hora na guia de toda a cápsula.
- **Do** mostrar o prazo de expiração dos ficheiros; a menos de 1 h em `warning`.
- **Do** manter fontes e bibliotecas no bundle (CSP `self`, sem internet).
- **Don't** usar âmbar para decoração, nem cinzento puro sobre o casco (usar `shell-muted`).
- **Don't** pôr bordas coloridas laterais nas cápsulas; a distinção é a guia.
- **Don't** animar o histórico ao abrir; só o que chega depois.
