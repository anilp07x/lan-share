# Product

## Platform
web (PWA instalável; mobile-first, também usada no computador que serve)

## Stack
React 19 + Vite + Tailwind v4 (cliente), Fastify/Node 24 (servidor). Tudo offline: fontes e bibliotecas ficam no bundle, nunca em CDN.

## Users
Pessoas na mesma rede (casa, escritório, sala de aula) que querem passar texto, links, fotos e ficheiros entre o telemóvel e o computador, ou entre telemóveis, sem cabos, contas nem internet. Uso breve e frequente: abrir, largar, apanhar, fechar.

## Product Purpose
Um canal partilhado na LAN: tudo o que alguém envia aparece em todos os dispositivos ligados, em tempo real.

## Positioning
Mais simples do que AirDrop/Nearby Share (funciona em qualquer browser e entre sistemas) e mais privado do que apps de mensagens (nada sai da rede local).

## Operating Context
Telemóvel na mão, muitas vezes em pé; computador ao lado. Luz variada (dia e noite), por isso claro e escuro seguem o sistema.

## Capabilities and Constraints
- Texto até 2000 caracteres; ficheiros até 2 GB; ficheiros expiram ao fim de 24 h (configurável).
- Acesso por PIN de 6 dígitos; por defeito todos os autenticados veem tudo.
- Envios "só para" alguns dispositivos são filtrados pelo servidor por id de dispositivo. Como a identidade não é autenticada, é privacidade de cortesia entre quem já tem o PIN, não segredo forte.
- Identidade do dispositivo (nome) é local e não autenticada — serve para orientação, não para segurança.
- CSP restrita: só recursos do próprio servidor.

## Brand Commitments
- Nome: LAN Share. Idioma da interface: português europeu.
- Direção visual escolhida pelo utilizador (2026-11-04): "correio pneumático" — cada envio é uma cápsula expedida pela rede.

## Evidence on Hand
Sem logótipo próprio além do ícone PWA gerado; sem fotografia.

## Product Principles
- Largar e apanhar em segundos: o compositor e o último envio estão sempre à mão.
- Estado sempre honesto: ligação, progresso, expiração.
- Funciona igual em qualquer dispositivo e sem rede externa.

## Accessibility & Inclusion
WCAG AA: contraste, foco visível, alvos de toque ≥ 44 px no telemóvel, `prefers-reduced-motion` respeitado, nomes acessíveis em todos os controlos.
