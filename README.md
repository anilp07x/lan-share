# LAN Share

Troca de mensagens e ficheiros entre dispositivos na mesma rede local — **100% offline**, sem internet, sem contas, sem cabos.

Um dispositivo (PC Windows/Linux/Mac) faz de servidor na rede Wi‑Fi/cabo; qualquer telemóvel abre o **URL daqui** no browser (Chrome/Edge/Safari) e participa. Ficheiros vão **diretamente do telemóvel para o disco do PC** — não passam por nenhum servidor externo.

- Texto em tempo real (WebSocket) e upload de ficheiros até **2 GB**
- Instalável como app (PWA) — funciona sem rede assim que a página carregue
- Um **PIN** protege o acesso; todos na LAN veem tudo
- Ficheiros expiram ao fim de **24 h** (configurável); o disco nunca fica cheio
- Feito em Node.js (Fastify) + React/Vite, TypeScript rigoroso, testes automatizados

## Usar

```bash
npm install
npm run build   # compila o cliente (feito uma vez)
npm start
```

O terminal mostra:

```
PIN de acesso (mostra aos telemóveis)   ← os convidados precisam disto
── Abre a LAN Share noutro telemóvel em: ──
http://192.168.x.x:3000                  ← um URL por interface + QR
```

Nos telemóveis (mesma rede Wi‑Fi): abrir o URL, escrever o PIN, começar. Para instalar: opção **Adicionar ao ecrã principal** no Android/*Adicionar à App* no iOS.

Para desenvolvimento:

```bash
npm run dev:client  # Vite em :5173 (proxy para o servidor em :3000)
npm run dev         # servidor com --watch (node 24 executa .ts direto)
npm test            # 19 testes de integração
npm run typecheck   # TS rigoroso (servidor + cliente)
npm run icons       # regenera os ícones PWA
```

## Configuração (variáveis de ambiente)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta do servidor |
| `HOST` | `0.0.0.0` | Interface a escutar |
| `PIN` | gerado | Código de acesso (6 dígitos) |
| `MAX_FILE_MB` | `2048` | Tamanho máximo por ficheiro |
| `RETENTION_HOURS` | `24` | Vida útil dos ficheiros; `0` = nunca apagar |
| `MAX_TEXT_LEN` | `2000` | Máximo de texto por mensagem |
| `HISTORY_LIMIT` | `50` | Mensagens que um novo visitante recebe |
| `MIN_FREE_DISK_MB` | `512` | Recusa uploads se o disco ficar abaixo disto |
| `SWEEP_INTERVAL_MIN` | `5` | Frequência da limpeza de expirados (≥1) |
| `UPLOAD_DIR` | `./data/files` | Onde ficam os ficheiros |

## Segurança

- **LAN‑only por conceção**: o servidor escuta em `0.0.0.0` para ser alcançável na LAN, mas **não** está preparado para internet — sem TLS, sem auth HTTPS. Nunca faças port‑forwarding nem hospedes numa cloud.
- Sessão por cookie `HttpOnly`/`SameSite=strict` (12 h); sem cookie → `401`.
- Rate‑limit global + bloqueio temporário do PIN após tentativas falhadas.
- CSP via Helmet; sanitização de nomes de ficheiro (aplicação de `path.basename`); sem execução de conteúdo enviado.
- Não há phishing/limites "de ficheiro por dispositivo" — é uma ferramenta para casa/escritório de confiança.

## Dicas de rede (Angola / redes 2.4 GHz)

- Se o telemóvel não liga, confirma que está na **mesma rede** que o PC (Wi‑Fi ou hot-spot) e que o "isolamento entre clientes" do router está desligado (alguns routers hotel/operadora bloqueiam dispositivos entre si).
- IPs mudam com o DHCP: o QR/URL re‑imprimem-se quando a rede muda (`Ctrl+C` e `npm start` de novo).
- Actualiza o nome do PC no router para o encontrar facilmente; usa o navegador do telemóvel, não um instalador adicional.

## Limitações conhecidas

- Requer Node.js ≥ 24 no PC servidor (executa `.ts` diretamente).
- Mensagens têm envio em broadcast — todos os ligados à sessão veem o mesmo feed.
- Sem encriptação de ponta a ponta (rede doméstica/LAN).
- Pré‑visualização inline só para imagens (≤ 20 MB); o QR no terminal renderiza melhor no Windows Terminal ou no VS Code.