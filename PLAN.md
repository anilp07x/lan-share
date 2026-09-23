# LAN Share — Plano de Implementação

Aplicação LAN-only de troca de texto + ficheiros. Host Windows 10/11, clientes via browser
(Android, iPhone, Windows). 100% offline. Servidor Node.js LTS + Fastify, cliente React + Vite PWA.

---

## 0. Decisões de arquitectura (e porquê)

| Decisão | Escolha | Justificação |
|---|---|---|
| Linguagem servidor | TypeScript com *type stripping* nativo do Node 24 | Node 24.18 corre `.ts` directamente (sem flag); `tsc --noEmit` só para verificação em dev. Segurança de tipos sem build nem *runtime* extra — o arranque continua `node server/index.ts` |
| Constantes TS | Apenas sintaxe "erasable" (sem `enum`, `namespace`, *parameter properties*) | Exigência do *type stripping* nativo; `erasableSyntaxOnly: true`, `import ... from './x.ts'` com extensão |
| WebSocket | Recebe sempre, cliente nunca envia dados (só pings do protocolo) | Texto/uploads são HTTP (erros + rate-limit uniformes); WS só notifica em tempo real |
| Histórico | `GET /api/history` (HTTP) para o arranque da página + WS para eventos novos | Fallback se o WS tardar; reutiliza a mesma função do `store` |
| Downloads e preview | `@fastify/static` com `prefix: /api/files/`, ficheiros guardados com o próprio `fileId` como nome | Ganhamos streaming, suporte a `Range` (retoma de downloads), `Content-Length`, controlo de cache — sem re-implementar |
| Uploads | `req.file({ limits })` com `pipeline()` stream→disco (`.part` em subpasta `tmp/`) | Nunca em memória; `@fastify/multipart` já é um parser de streaming |
| QR no terminal | `qrcode-terminal` (0.12.0, zero dependências) | Requisito 5; única lib extra fora da stack fixa |
| Ícones PWA | Script dev `scripts/generate-icons.mjs` com `pngjs` (dev-dep) | Gera PNGs 192/512/180 localmente; sem CDN, sem fontes externas |
| Deps de tipos | `typescript`, `@types/node`, `@types/ws` (todas devDeps) | Tipos consumidos em *dev*; nada disto entra no runtime |
| Sessões | Em memória (`Map`), cookie HttpOnly | LAN monolítica; reiniciar servidor = voltar a introduzir PIN (comportamento aceite e documentado) |
| Espaço livre | `fs.promises.statfs` (nativo desde Node 18.15) | Zero dependências |

**Ambiente verificado (versões instaladas):**
`fastify@5.12.5`, `@fastify/websocket@11.3.1` (base `ws@8`), `@fastify/multipart@10.1.2`,
`@fastify/rate-limit@11.2.0`, `@fastify/static@10.1.4`, `@fastify/cookie@11.1.2`,
`qrcode-terminal@0.12.0`, `vite@8.3.0`, `react@19.3.0`, `pngjs@7.0.0`, Node `v24.18.1`.

Pontos confirmados na documentação (para não inventar APIs):
- `@fastify/multipart`: `req.file({limits:{fileSize:{files}}})` devolve `{file, filename, mimetype, …}`;
  `data.file.truncated`; `fastify.multipartErrors.RequestFileTooLargeError`; **o limite `fileSize`
  por omissão é o `bodyLimit` do Fastify (1 MiB)** — temos de o definir explicitamente;
  multipart **não** passa pelo `bodyLimit` global (agregado a controlar por `files:1` + `fileSize`).
- `@fastify/websocket`: handler `(socket, req)` com `{ websocket: true }`; hooks `onRequest`/`preValidation`
  correm **antes** do upgrade → autenticação igual à do HTTP; opções `ws` via `options.maxPayload`.
- `@fastify/rate-limit`: opção `ban` (nº de 429 até dar 403; `ban:0` → 403 directo ao exceder `max`);
  `timeWindow` aceita string/ms; `keyGenerator` por IP (normalizado); `config.rateLimit` por rota;
  `continueExceeding` mantém o bloqueio enquanto o utilizador insiste.
- `@fastify/static`: `setHeaders(res, path, stat)` permite `Content-Disposition` e `Content-Type`
  por pedido (via `res.req.query`); `acceptRanges` activo por omissão.

---

## a) Estrutura de pastas

```
LocalSend/
├─ PLAN.md
├─ README.md                  # setup, env vars, aviso LAN-only, limitações
├─ package.json               # um único package (server + client + scripts)
├─ tsconfig.base.json
├─ tsconfig.server.json       # tsc --noEmit: node, erasableSyntaxOnly, allowImportingTsExtensions
├─ tsconfig.client.json       # tsc --noEmit: DOM, bundler (Vite)
├─ .env.example
├─ .gitignore                 # node_modules, client/dist, data/
│
├─ scripts/
│  └─ generate-icons.mjs      # dev: gera client/public/icons/*.png com pngjs
│
├─ server/
│  ├─ index.ts                # bootstrap: config→arranque→sweep→listen→print URLs/QR/PIN
│  ├─ config.ts               # parse/validação de process.env (com defaults)
│  ├─ app.ts                  # instância Fastify + registo de plugins/rotas/hooks
│  ├─ types.ts                # tipos partilhados (Message, FileMeta, ErrorCode, env)
│  ├─ routes/
│  │  ├─ auth.ts              # login/logout/status + sessões
│  │  ├─ messages.ts          # POST /api/messages
│  │  ├─ upload.ts            # POST /api/upload (streaming)
│  │  └─ history.ts           # GET /api/history
│  ├─ ws/
│  │  └─ index.ts             # rota /ws: auth + histórico + broadcast (receive-only)
│  ├─ lib/
│  │  ├─ store.ts             # índice JSON em memória + escrita atómica
│  │  ├─ sweeper.ts           # retenção + órfãos + tmp (arranque e periódico)
│  │  ├─ sessions.ts          # mapa de sessões + cookie (HttpOnly)
│  │  ├─ auth.ts              # verificação do PIN (timing-safe) + requireSession hook
│  │  ├─ net.ts               # interfaces de rede + URLs + QR + re-varredura
│  │  ├─ disk.ts              # statfs (espaço livre) + helpers
│  │  └─ sanitize.ts          # nomes de ficheiro + Content-Disposition (RFC 5987)
│  ├─ qrcode-terminal.d.ts    # declaração de tipos para qrcode-terminal (sem tipos próprios)
│  └─ test/
│     ├─ sanitize.test.ts
│     ├─ store.test.ts
│     └─ retention.test.ts    # node:test (zero dependências)
│
├─ client/
│  ├─ vite.config.ts          # root=./client, build → ./client/dist, proxy dev /api + /ws
│  ├─ index.html
│  ├─ public/
│  │  ├─ manifest.webmanifest
│  │  ├─ sw.js
│  │  └─ icons/               # 192.png, 512.png, apple-touch-icon.png (gerados)
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx              # router de estado: login | feed
│     ├─ api.ts               # fetch + upload XHR (progresso/cancelamento)
│     ├─ ws.ts                # WebSocket + reconexão (backoff exponencial) + estado
│     ├─ components/
│     │  ├─ Login.tsx         # PIN pad com protecção anti-clique duplo
│     │  ├─ Feed.tsx
│     │  ├─ StatusBar.tsx     # ligado / a reconectar / PIN errado
│     │  ├─ Composer.tsx      # texto, botão ficheiro, drop-zone, colar imagem
│     │  ├─ MessageItem.tsx   # texto (copiar) | ficheiro (descarregar/preview)
│     │  └─ UploadCard.tsx    # progresso real, cancelar, reenviar
│     └─ styles.css           # mobile-first, dark, sem libs
│
└─ data/                      # criado em runtime (gitignored)
   ├─ files/                  # final: <fileId> (nome == fileId, sem extensão)
   │   └─ tmp/                # <fileId>.part durante o upload
   └─ index.json              # índice de metadados (escrita atómica)
```

**Servidor sem *build*** — o Node 24 corre `server/*.ts` directamente (*type stripping*); `tsc --noEmit`
(script `typecheck`) verifica os tipos em dev, sem nunca emitir JS. **Cliente** é TypeScript/React compilado
pelo Vite (`tsconfig.client.json`).

---

## b) Contrato das rotas HTTP e mensagens WebSocket

Todas as respostas de erro têm o formato:
```json
{ "error": { "code": "…", "message": "mensagem em português" } }
```

### Publicas (sem sessão)

| Método/rota | Body/Query | Sucesso | Erros |
|---|---|---|---|
| `GET /` e assets estáticos, `/manifest.webmanifest`, `/sw.js`, `/icons/*` | — | 200 (SPA) | 404 |
| `POST /api/auth/login` | `{"pin":"123456"}` | 200 `{"ok":true}` + `Set-Cookie` `lan_share_session` (HttpOnly, SameSite=Strict, Path=/, Max-Age 12h) | 400 formato; 401 `PIN_INVALID`; 429/403 `RATE_LIMITED` |
| `GET /api/auth/status` | — | 200 `{"authenticated":true\|false}` | 401 nunca (é o modo de saber) |
| `POST /api/auth/logout` | — | 200 `{"ok":true}` + cookie expirado | 401 |

### Autenticadas (`requireSession`: cookie válido em todas)

| Método/rota | Body/Query | Sucesso | Erros |
|---|---|---|---|
| `GET /api/history` | `?limit=N` (default `HISTORY_LIMIT`) | 200 `{"messages":[…]}` | 401 `UNAUTHORIZED` |
| `POST /api/messages` | `{"body":"olá"}` | 201 `{"message":{…}}` | 400 `TEXT_EMPTY`/`TEXT_TOO_LONG`; 401; 429 |
| `POST /api/upload` | multipart, campo `file` | 201 `{"message":{…}}` | 400 `NO_FILE`; 413 `FILE_TOO_LARGE`; 413 `TOO_MANY_FILES`; 507 `DISK_FULL`; 401; 429 |
| `GET /api/files/:fileId` | `?inline=1` p/ preview | 200 stream (Range suportado) | 401; 404 `NOT_FOUND` |
| `WS /ws` (upgrade) | cookie de sessão | 101 → frames abaixo | 401 no upgrade (client vê "reenviar PIN") |

Cabeçalhos de ficheiros em `GET /api/files/:fileId`:
- `Content-Disposition: attachment; filename="<fallback ASCII>"; filename*=UTF-8''<encoded>`  (ou `inline` se `?inline=1`)
- `Content-Type`: mime guardado se estiver na allowlist de visualização (`image/*`), senão `application/octet-stream` (download sem execução no browser)
- `X-Content-Type-Options: nosniff` · `Content-Length` · `Accept-Ranges: bytes`

### Mensagens WebSocket (servidor → cliente; o cliente só responde a pings do protocolo)

| Frame | Payload | Quando |
|---|---|---|
| `history` | `{"t":"history","messages":[…]}` | no `open` (uma vez por ligação) |
| `message` | `{"t":"message","message":{…}}` | novo texto/ficheiro (para todos, incluindo o emissor) |
| `file-expired` | `{"t":"file-expired","fileId":"…"}` | remoção automática durante sessão activa |
| `error` | `{"t":"error","code":"…","message":"…"}` | chamadas do cliente que falham em runtime |

Códigos de fecho: `4401` se a sessão expirar (o cliente volta ao login), `1001` em shutdown do servidor.
O servidor envia ping a cada 30 s e termina ligações mortas (`options.maxPayload: 1024`, pois o cliente não envia dados).

### Modelo de mensagem (partilhado HTTP + WS)

```jsonc
{ "kind": "text" }
{ "id": "m_ab12cd34ef56",
  "ts": 1758660000000,
  "kind": "text",
  "body": "olá mundo" }

{ "kind": "file" }
{ "id": "m_ff1122334455",
  "ts": 1758660001000,
  "kind": "file",
  "file": { "fileId": "9f1c…-…uuid",
            "name": "Relatório final (v2).pdf",   // sanitizado só para exibição
            "size": 12345678,
            "mime": "application/pdf" } }
```

### Rate limits (`@fastify/rate-limit`)

| Âmbito | Config |
|---|---|
| Global (todas as rotas API) | `max: 300`, `timeWindow: '1 minuto'` |
| `POST /api/auth/login` | `config.rateLimit: { max: 5, timeWindow: '5 minutos', ban: 0, continueExceeding: true }` → 5 tentativas e 403 até a janela reiniciar |
| `GET /api/auth/status`, assets estáticos | `config.rateLimit: false` (não penalizar quem acabou de abrir a app) |

Verificações de segurança no login: comparação do PIN com `crypto.timingSafeEqual` e PIN sempre como string de 6 dígitos; sessão = `crypto.randomBytes(32)` em cookie `HttpOnly`, `SameSite=Strict` (bloqueia CSRF); sessões expiradas são podadas a cada 10 min. O PIN **nunca** aparece em URL, headers ou logs.

---

## c) Modelo do índice de metadados

Ficheiro `data/index.json` (escrita atómica). Persistimos apenas a lista de mensagens; o mapa de ficheiros é derivado em memória.

```jsonc
{
  "version": 1,
  "messages": [
    { "id": "m_…", "ts": 1758660000000, "kind": "text", "body": "olá" },
    { "id": "m_…", "ts": 1758660005000, "kind": "file",
      "file": { "fileId": "…uuid…", "name": "Relatório final (v2).pdf", "size": 12345678, "mime": "application/pdf" } }
  ]
}
```

Em memória (`store.ts`):
- `messages: Array<Message>` (ordem cronológica = ordem do array)
- `fileById: Map<fileId, Message>` (derivado, para lookups rápidos O(1) em download/sweep)

Escrita atómica (todas as mutações passam por aqui):
1. `JSON.stringify` → escrever `index.json.tmp` (mesmo volume)
2. `fs.rename(tmp, index)`
3. em `EPERM` (antivírus/Windows): 3 tentativas com 50 ms de espera antes de falhar com log.

Início/recuperação (no boot) e sweep periódico — **ordem importa**:
1. Se `index.json` não existir → criar com `{version:1, messages:[]}`
2. Se estiver malformado/ilegível → renomear para `index.corrupt-<timestamp>.json`, registar aviso e começar vazio
3. `tmp/`: apagar todos os `*.part` (sobras de uploads cancelados/crash)
4. `files/`: apagar qualquer ficheiro **não referenciado** no índice (órfão)
5. Índice: remover mensagens `kind:"file"` cujo ficheiro já não existe
6. Retenção: remover mensagens com `ts < now − RETENTION_HOURS` e apagar os ficheiros correspondentes
7. Persistir o índice limpo; logar resumo (`X mensagens, Y ficheiros, Z removidos`)

O sweep periódico corre a cada `min(60 min, RETENTION_HOURS/6)` → durante sessões activas emite
frame `file-expired`. Nunca toca em `*.part` (evita apagar uploads em curso; os `.part` só são limpos no boot).

---

## d) Riscos técnicos e mitigações

| # | Risco | Mitigação |
|---|---|---|
| 1 | Upload de 1 GB em memória | `pipeline(stream, createWriteStream)`; nunca `toBuffer()`; validator "prova": log de `process.memoryUsage()` após testes |
| 2 | Cancelamento/queda a meio = lixo em disco | Upload para `tmp/<fileId>.part`; `try/finally` apaga; `.part` órfãos removidos no boot; `catch` no pipeline limpa antes de responder 4xx/5xx |
| 3 | Disco cheio a meio (ENOSPC) | Pré-check `statfs` (`livre − MIN_FREE_DISK_MB ≥ Content-Length`) → 507 antes de aceitar; `ENOSPC` durante pipeline → apagar `.part` + responder 507 |
| 4 | `rename`/`unlink` relacionados com antivírus no Windows | `rename` com retry (EPERM); `tmp/` e destino no mesmo volume; apagar com `fs.rm` com retries |
| 5 | Corte de energia a meio da escrita do índice | Escrita atómica tmp+rename; boot com recuperação (passos 2–7 de c) — nunca arranca com índice corrompido |
| 6 | Nomes hostis (`../`, control chars) | Nome nunca é caminho (só `fileId`); sanitizar nome para exibição e para `Content-Disposition` (RFC 5987: fallback ASCII + `filename*`); validar `fileId` com regex UUID no download |
| 7 | XSS via texto/nome | React escapa sempre (sem `dangerouslySetInnerHTML`); CSP apertada com `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; ficheiros servidos como `octet-stream` por omissão |
| 8 | Brute-force do PIN (6 dígitos = fraco) | Rate-limit por IP com `ban` (5 / 5 min); `timingSafeEqual`; cookie `HttpOnly`; documento: LAN é confiança partilhada, nunca expor por port forwarding |
| 9 | IP do host muda (DHCP) | Boot imprime URL por interface + QR; re-varredura a cada 60 s imprime mudanças e novo QR só se o principal mudar. Limitação aceite fase 1: cliente com IP antigo precisa do novo URL (mDNS fica para fase 2) |
| 10 | Hotspot com isolamento de clientes (AP isolation) | Documentado no README; não resolvível em software |
| 11 | Wi-Fi 2.4 GHz lento / cortes a meio do download | Downloads via `@fastify/static` com `Range` (browsers retomam); upload recomeça com o botão "reenviar" |
| 12 | Conexão WS cai e perde eventos | Reconexão com backoff exponencial (1 s→15 s, jitter); ao religar, `history` volta via `GET /api/history`; estado visível (ligado / a reconectar) |
| 13 | Dois uploads a correr contra o sweep | Sweep periódico nunca elimina ficheiro com `ts > cutoff` nem `.part` (só boot); entradas só entram no índice **depois** do `rename` |
| 14 | `@fastify/multipart` acumular em memória por defeito | Definir `fileSize` e `files:1` no registo; nunca usar `attachFieldsToBody`/`saveRequestFiles`; tratar `RequestFileTooLargeError` e `file.truncated` → 413 + cleanup |
| 15 | iOS Safari: progresso de upload e colagem | Upload por `XMLHttpRequest` (`xhr.upload.onprogress`; `fetch` não expõe progresso); colar imagem via evento `paste` com fallback ao `<input type=file accept="image/*">` |
| 16 | QR ilegível no terminal Windows | `qrcode-terminal` + recomendar Windows Terminal; QR do URL principal (primeira interface preferida: `192.168.*` → `10.*` → `172.16-31.*`) |

---

## e) Plano de implementação em passos pequenos e verificáveis

> Cada passo termina com **como validar manualmente**. Não se avança sem validar.

**Passo 0 — Esqueleto.**
`package.json` (type:module), deps instaladas, tsconfigs (`base/server/client`), `.gitignore`, `.env.example`,
`README.md` mínimo, `config.ts` (parse/validação de todas as env vars com defaults), `server/index.ts` com Fastify
"Hello World", `server/app.ts` (regista @fastify/static a servir `client/dist` — placeholder `index.html`),
script `typecheck` (`tsc --noEmit` nos dois projetos).

*Validar: `npm start` → `node server/index.ts` corre nativamente (type stripping) → `curl http://localhost:3000/api/health`
responde; `npm run typecheck` verde; env invalidada (ex.: `PORT=abc`) aborta com mensagem clara.*

**Passo 1 — Config, logging e autenticação.**
`config.ts` complete, logging no arranque, `sessions.ts`, `routes/auth.ts`, rate-limit global + da rota de login,
hook `requireSession` (aplicado às rotas API e ao WS mais tarde). Geração do PIN aleatório quando `PIN` ausente
(mostrado no terminal).

*Validar (curl/PowerShell): login com PIN correcto devolve cookie; PIN errado → 401; 6ª tentativa → 403;
com cookie, `GET /api/auth/status` → `authenticated:true`; sem cookie → `false`; `logout` invalida.*

**Passo 2 — Storage atómico, retenção e disco.**
`store.ts` (escrever/carregar/append/remove), `sweeper.ts`, `disk.ts` (statfs), `sanitize.ts`
(Content-Disposition), testes `node --test` (`.test.ts` também correm nativamente) para sanitize/store/retention.

*Validar: `npm test` verde; `node -e "fs.promises.statfs(...)"` mostra bytes; simular índice corrompido
(corromper `index.json`) → boot cria `index.corrupt-<ts>.json` e arranca; matar com `kill` a meio de um write →
o boot seguinte recupera sem ficheiros órfãos (criar um `.part` e um ficheiro solto à mão → são removidos).*

**Passo 3 — Texto e ficheiros (HTTP + disco).**
`routes/messages.ts` (valida tamanho, append, broadcast a partir de já), `routes/upload.ts`
(streaming, `.part`, cancelamento, 413/507, rename, index, broadcast), `routes/history.ts`,
downloads via `@fastify/static` (sub-plugin com hook `requireSession`, `setHeaders` com
Content-Disposition RFC 5987 e Content-Type).

*Validar: `curl -F "file=@Relatório final (v2).pdf" http://…/api/upload` com cookie; descarregar e conferir
nome/bytes (`CertUtil -hashfile`); tcpkill/cancelar a meio de um ficheiro grande → `tmp/` fica vazio; subir
`MAX_FILE_MB` baixo → 413; encher um diretório com `MIN_FREE_DISK_MB` alto → 507; texto com `MAX_TEXT_LEN`
ultrapassado → 400.*

**Passo 4 — WebSocket em tempo real.**
`server/ws/index.ts` (rota `/ws` com `websocket:true`, auth no `preValidation`, ping 30 s,
`maxPayload:1024`, `ws-hub` interno, broadcast `message`/`file-expired`, `history` no open).

*Validar: duas janelas do browser no PC + um telemóvel; mensagem de A aparece em B e C em tempo real;
desligar Wi-Fi do telemóvel durante 10 s → o estado muda para "a reconectar" e volta sozinho com o histórico
consistente; sessão expirada → upgrade recusado (401) e SPA volta ao login.*

**Passo 5 — Arranque completo do servidor.**
`server/index.ts` final: ordem config→sweep→listen→print (URLs por interface, QR, PIN, espaço livre,
aviso LAN-only), re-varredura de interfaces a cada 60 s, shutdown gracioso (SIGINT: fecha WS com 1001,
flushes índice, fecha).

*Validar: reiniciar com dados no `data/` → histórico reabre e ficheiros continuam accionáveis; QR no terminal
lê-se com a câmara do telemóvel; URLs por todas as interfaces presentes; `Ctrl+C` limpo sem excepções.*

**Passo 6 — Cliente React (login, feed, compositor, uploads).**
`client/`: App (login vs feed), StatusBar, Composer (texto + `input[type=file]` + drop-zone + colar imagem),
Feed com histórico + mensagens novas, MessageItem (copiar texto, download com nome, preview de imagem
com `loading=lazy` e limite client-side `PREVIEW_MAX_MB=20`), UploadCard (progresso XHR, cancelar, reenviar,
fila sequencial), `ws.ts` (reconexão + estado), `api.ts`.

*Validar checklist: Android (Chrome) e iPhone (Safari) e Windows (Edge/Chrome) — login, texto, copiar,
enviar ficheiro com acentos/espaços, progresso, cancelar, reenviar, preview de imagem, descarregar com o
nome original, reconexão com corte de Wi-Fi, estado visível.*

**Passo 7 — PWA, segurança e README.**
`manifest.webmanifest`, `sw.js` (pré-cache do shell, cache-first para assets, nunca para `/api`), registo do
SW só em produção, ícones via `scripts/generate-icons.mjs`, CSP dinâmica por pedido (`connect-src` com
`ws://<host>`), headers de segurança, `README.md` final (env vars, limitações, hotspots/AP isolation,
**nunca port forwarding**).

*Validar: `npm run build` + `npm start`, abrir no telemóvel → botão "Adicionar ao ecrã principal" (Android)
e "Adicionar ao ecrã início" (iOS); roda offline sem rede; abrir a app como PWA e testar texto+ficheiro;
inspecionar headers (DevTools) e CSP.*

**Passo 8 — Validação de critérios de aceitação (stress).**
Teste final em cenário real Angolano: 1 GB (memória estável — log `memoryUsage` antes/depois), reinício a
meio com ficheiros, corte de Wi-Fi a meio do upload, `RETENTION_HOURS=0.1` para ver expiração automática,
**cabo de internet desligado de todo**, vários dispositivos em simultâneo.

*Validar: tabela de critérios de aceitação completa em README; registar resultados em `TEST.md`.*

---

## Configuração por ambiente (com defaults)

| Var | Default | Notas |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `HOST` | `0.0.0.0` | Bind em todas as interfaces |
| `PIN` | gerado (6 dígitos) | Mostrado no terminal; nunca um default fixo |
| `MAX_FILE_MB` | `2048` | Limite por ficheiro (≥ 1024 para o critério do 1 GB) |
| `RETENTION_HOURS` | `24` | Expiração de textos e ficheiros; script de teste: `RETENTION_HOURS=0.01` |
| `UPLOAD_DIR` | `./data/files` | Pasta dos ficheiros (final) + `tmp/` |
| `MIN_FREE_DISK_MB` | `512` | Mínimo livre após um upload aceite |
| `MAX_TEXT_LEN` | `2000` | *(extra justificado pelo requisito "limite configurável")* |
| `HISTORY_LIMIT` | `50` | *(extra justificado pelo requisito "últimas N mensagens")* |

## Fora de âmbito (fase 2)
mDNS (`*.local`), HTTPS/mkcert, Tauri, salas/canais, contas, verificação de estilo/semaforização de uploads paralelos.