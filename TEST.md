# Testes — LAN Share

## Automatizados

### Suite de integração (`npm test`)

19 testes em `server/test/**/*.test.ts` (fica verde com `Python`/Fastify real, sem mocks):

- Auth: login certo/errado, bloqueio temporário, logout, `status`, rate-limit 429.
- Store: persistência, poda de antigas (`UNAUTHORIZED`, `NOT_FOUND`), índice corrompido → backup, reconcile.
- Mensagens: validação de texto (vazio, >MAX), sanitização de nomes (diretoria espetada), upload (413, 507, extensões), download (Range), histórico clamp (50), URLs 404/401.
- WebSocket: `history` no connect, broadcast multi-dispositivo, 401 sem sessão, frame > maxPayload, `file-expired`.

Requisitos de execução: Node ≥ 24.

### Stress (`npm run stress`)

`scripts/stress.mjs` spawna o servidor real em portas efémeras com `data` em pasta temporária e cobre:

| Check | O que valida |
| --- | --- |
| Upload 160 MiB em **streaming** (multipart manual, sem bufferizar) | chega ao disco; tamanho exato |
| Download 160 MiB | 200, md5 idêntico |
| Dois uploads paralelos (60 MiB cada) | ambos 201, fila sequencial sã |
| Nomes com espaço/acentos | guardados **por id** no disco (nenhum nome do utilizador fica no sistema) |
| Flood de 120 mensagens | histórico clampado a 50, mais recentes primeiro |
| Expiração (RETENTION_HOURS tiny + sweep 1 min) | após sweep → 404 no download, **broadcast WS `file-expired`**, ficheiro apagado do disco e do índice |

Corre em ~1 min (o sweep espera o ciclo real). Não deixa lixo (limpa as pastas `data` temporárias).

## Checklist manual (dispositivos reais — sem automação possível)

Rede: Wi‑Fi real 2.4 GHz com 2 telemóveis + PC servidor na mesma rede.

**Arranque**
- [ ] `npm start` imprime PIN + um URL/linha por interface de rede + QR do URL preferido + espaço livre.
- [ ] QR legível no terminal (Windows Terminal recomendado).
- [ ] Abrir o URL num Android (Chrome) e num iPhone (Safari) → ecrã de login.

**Sessão/PIN**
- [ ] PIN errado mostra erro; 5 falhas seguidas bloqueiam vários minutos (`PIN_BLOCKED`).
- [ ] PIN certo entra; recarregar a página mantém sessão.
- [ ] Trocar o PIN (reiniciar com `PIN=`) invalida a sessão do telemóvel.

**Tempo real**
- [ ] Texto escrito no PC aparece nos 2 telemóveis e vice-versa, sem recarregar.
- [ ] Tecla Enter envia; Shift+Enter abre linha; mensagens longas (>2000) são recusadas com erro.

**Uploads (no telemóvel)**
- [ ] Ficheiro real grande (ex.: 500 MB–1 GB de vídeo) a partir da galeria: barra de progresso, chega ao PC intacto (comparar tamanho/hash).
- [ ] Enviar enquanto colado: fila sequencial; cancelar e reenviar funcionam.
- [ ] Colar uma imagem da fotografia → thumbnail inline; tocar → pré-visualização/download.
- [ ] Nome com acentos (ex.: `Relatório final (v2).pdf`) mantém o nome no download, nos 2 lados.
- [ ] 2 telemóveis a enviar em simultâneo: ambos chegam, sem mistura.

**Expiração**
- [ ] Com `RETENTION_HOURS=0.03` (~2 min): o ficheiro some do feed dos outros dispositivos e o download dá "não encontrado" (definir e arrancar).

**Resistência (cenário Angolista)**
- [ ] Deixar uma página aberta e desligar/ligar o Wi‑Fi do telemóvel: StatusBar passa a "a reconectar" e a sessão retoma sozinha.
- [ ] Cortar a energia ao PC (ligar/desligar, não Ctrl+C): ao arrancar, mensagens e ficheiros continuam; índice corrompido é salvado como backup e o app não parte.
- [ ] Com o disco quase cheio: upload é recusado com aviso claro.
- [ ] Escrever 60+ mensagens rápido: feed mostra só as 50 mais recentes ao ligar outro dispositivo.

**PWA/instalação**
- [ ] Android: "Adicionar ao ecrã principal" → abre standalone com ícone; desligar a internet e reabrir → a página continua (capa instalada).
- [ ] iPhone: "Partilhar → Adicionar à app" → ícone e modo standalone.

**CSP/segurança (devtools)**
- [ ] `curl -D - http://ip:3000/` mostra `Content-Security-Policy`, `nosniff`, `no-referrer`.
- [ ] `/api/history` sem cookie → 401 JSON `{"error":{"code":"UNAUTHORIZED"}}`.
- [ ] `/sw.js` e `/manifest.webmanifest` servidos com `Cache-Control: no-cache`.

**Shutdown gracioso**
- [ ] No terminal do PC, `Ctrl+C`: logs "A encerrar graciosamente…", sessões WS fechadas e processo termina em menos de ~2 s.

## Erros conhecidos / aceitabilidades

- QR no terminal depende do emulador ANSI; alguns terminais antigos do Windows não o mostram — o URL aparece sempre acima dele.
- iPhone Safari pode não mostrar o QR com `small`; se pairar, abrir primeiro a lista de URLs.
- O `npm run stress` usa portas 4111/4112; garantir que não há servidor próprio a ouvir lá.