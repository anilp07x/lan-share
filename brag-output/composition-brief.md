# Hyperframes Composition Brief: LAN Share

## Objective
Create a short launch-style brag video for LAN Share — a LAN-only messaging and file-sharing PWA where a PC is the server and any phone on the same network opens a URL, types a 6-digit PIN, and sends files up to 2 GB straight to the PC's disk.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 23.5 seconds (30 fps)

## Source Material
- Project root: `C:\Users\AniDev\Documents\GitHub\lan-share`
- Primary files read: `README.md`, `PLAN.md`, `TEST.md`, `package.json`, `server/index.ts`, `client/src/components/Login.tsx`, `client/src/components/StatusBar.tsx`, `client/src/components/Composer.tsx`, `client/src/components/UploadChip.tsx`, `client/src/components/Feed.tsx`, `client/src/lib/format.ts`, `client/src/styles.css`, `client/public/manifest.webmanifest`
- Product name: LAN Share
- Tagline / strongest claim: **"Partilha o que importa, dentro da tua rede."** (hero of `Login.tsx`, verbatim)
- Key UI or visual moment to recreate: the login glass card (`.glass-card`, blur 24px + saturate 180%) with its conic `brand-ring` seal — the lock morphing into a drawn check. It is the best-looking frame in the product and doubles as the poster.
- Copy that must appear verbatim:
  - `Partilha o que importa, dentro da tua rede.` (`Login.tsx` hero)
  - `Larga aqui os ficheiros` / `Vão entrar na fila de envio.` (`Composer.tsx`)
  - `Bem-vindo de volta` / `Sessão iniciada` / `A abrir o teu espaço partilhado…` (`Login.tsx`)
  - `PIN de 6 dígitos` + `PIN completo, a validar.` + `Entrar` (`Login.tsx`)
  - `Sessão encriptada` · `Funciona sem internet` (`Login.tsx` footer)
  - `Ligação activa. Tudo o que enviares aparece aqui e nos outros dispositivos.` / `Nesta partilha` / `mensagens` / `ficheiros` / `transferidos` (`StatusBar.tsx`)
  - `── LAN Share ──` / `── Abre a LAN Share noutro telemóvel em: ──` (`server/index.ts`)
  - `Instantâneo` · `100% offline` · `Sem contas` with their hints (`Login.tsx` FEATURES array)

### Corrections to `brag-plan.md` (grounding wins)
1. **Scene 5 seals replaced.** The plan used "Até 2 GB — Por ficheiro, sem fila." That sub-line is false: `Composer.tsx:97` documents the upload queue as *"um de cada vez"*. Scene 5 now uses the product's own `FEATURES` array verbatim (`Instantâneo`, `100% offline`, `Sem contas`), which is grounded and echoes Scene 2. The 2 GB / 24 h claims stay grounded in Scene 4's copy and the README.
2. **Decimal separator.** `formatBytes()` uses `toFixed(1)`, so the app renders `1.2 GB` and `4.2 MB` with a dot, not a comma. On-screen text uses dots.
3. **One file, one size.** `formatBytes(1.21 GB)` → `"1.2 GB"`, so the upload chip, the attachment card and the stats rail all read `1.2 GB`. No "1,21 GB" anywhere.

## Creative Direction
- Tone preset: `app-store`
- Creative direction: an Apple product film — one claim per beat, terminal → phone → disk, no tricks, no joke, but the product genuinely working on screen
- Interpretation: smooth and precise. Fast entrances (0.3–0.5 s), long holds to read, clean slide/wipe transitions of 0.35–0.45 s, medium-weight title-case typography, zero caps lock, zero confetti. Confidence is the tone, not excitement.
- Angle: the product is the *absence* of everything — no cloud, no account, no cable, no app. The video shows the thing happening instead of describing it: a terminal prints a QR, the phone points its camera, the PIN opens the feed, and the file lands on the PC's disk. The tension is "wait, this is really local?" and the answer is `npm start`.
- Hook: a dark terminal window, `$ npm start` typed character by character, the LAN Share banner, the PIN, the URL, and a QR code drawing itself inside the terminal.
- Outro / punchline: the three real feature seals land in a row, then the brand lockup with **"Partilha o que importa, dentro da tua rede."** No CTA, no URL, no "disponível já".
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `#000000` (dark `theme_color` from `manifest.webmanifest`, `--background` in dark mode)
- Surface / card: `#1c1c1e` (`--card`)
- Text: `#f5f5f7` (`--foreground`) / muted `#98989d` (`--muted-foreground`)
- Accent: `#2997ff` (`--primary` dark) — send button, brand ring, `share` icon
- Success: `#30d158` (Ligado dot, PIN check, completed state) · Warning: `#ff9f0a` (reconnecting)
- Border: `#ffffff14` hairlines · Radius: `0.75rem` (cards), composer `rounded-2xl`
- Display font: `system-ui / -apple-system / 'Segoe UI'` — the project ships no webfont and that is part of the identity (resolves to Segoe UI in Windows Chrome)
- Body font: same stack. Terminal font: `ui-monospace, 'Cascadia Mono', Consolas` (Scene 1 only)
- Gradients copied from the project: `brand-ring` (conic blue→green around the logo), `text-gradient` (foreground→primary on the hero line), `aurora` (soft blue/green radials + a 44px grid under a radial mask)
- Strongest visual element: the login glass card with the gradient seal — poster frame.

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. **Terminal + QR** — 4.0 s — dark terminal window, `$ npm start` typed per character, real server output lines, a QR code drawn top to bottom; hook line **"Um comando. Um QR. É só isso."**
2. **O selo do PIN** — 4.0 s — the real login screen rebuilt: aurora + masked grid, header with `share` icon and "Rede local" badge, glass card with the six PIN slots filling one by one, then the lock becomes a drawn check and the copy switches to "Sessão iniciada".
3. **O feed a acontecer** — 4.5 s — the feed inside a phone frame: "Ligado" rail with pulsing dot, "Nesta partilha" counters ticking, three items arriving one at a time; copy **"Mensagens em tempo real. Todos na LAN veem tudo."**
4. **1.2 GB a atravessar o Wi-Fi** — 5.41 s — full-screen drop zone with the verbatim Composer copy, `Relatório final (v2).pdf` entering the queue, progress bar filling, then the attachment card landing in the feed at 17.05 s; copy **"Até 2 GB por ficheiro — do telemóvel para o disco do PC."**
5. **Três selos + lockup** — 5.59 s — the three real feature seals enter in a row at 18.44 / 19.49 / 20.54, then the share mark on its brand ring, "LAN Share", and the gradient hero line landing on the 21.59 s lock.

## Audio
- Audio role: warm, light musical bed plus a consistent, discreet SFX layer (`app-store` posture)
- Audio arc: calm and secure from the first second to the last; dry machine presence in the terminal, confidence on the PIN validation, light movement on the feed, weight and arrival on the upload, then rest and a clean close
- Music: `assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (copied from the /brag bundled preset)
- Music treatment: 0.3 s fade-in, steady volume 0.32, soft fade-out over the last 1.2 s, no ducking (there is no voice). Tempo 114.84 BPM leaves room for the reveals without feeling rushed.
- Music cue guidance: preset cue sheet at `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json` (tempo 114.84). Strong cues inside 0–25 s at 1.60, 3.18, 3.70, 5.28, 5.81, 6.34, 8.44, 8.96, 9.50, 11.60, 12.12, 12.65, 14.22, 16.86, 17.91, 19.49, 20.02, 20.54, 21.59, 22.65 — verified present in the copied file. Strong cue locks (max 3): **3.70 s** (hook line), **6.34 s** (PIN success seal), **21.59 s** (final line of the outro). The **17.91 s** cue is the scene 4→5 cut, so scene 5 starts there. Beat grid every second beat (~1.05 s) for the PIN digits, the feed items and the three seals.
- Audio-reactive treatment: subtle. The extracted bass band breathes the login aurora and gives presence to the attachment card and the final lockup. No waveform, no equalizer, no musical notes, no aggressive pulse. Data lives in `assets/music/analysis/audio-data.js` (`window.HF_AUDIO_DATA`, 705 frames × 16 log-spaced bands, 30 fps, per-band 98th-percentile normalized).
- Audio-coupled moments:
  - Scene 1 — command typed per character, output lines ticking in, QR drawing (interface `switch` swell)
  - Scene 2 — PIN digits entering with key sounds; success check drawn on the 6.34 s lock
  - Scene 3 — soft drop per arriving message; chip sound when the counters settle
  - Scene 4 — drop when the file enters the queue, thinned progress ticks, soft impact on the 17.05 s landing
  - Scene 5 — one drop per seal, single soft bell on the lockup, music fading out underneath
- SFX selection guidance: card sounds for the card-like reveals, short announcement cues for the payoff, key/click sounds for typing and user actions, restraint when the edit is already busy. Prefer the low high-frequency-risk files for repeated or polished moments.
- SFX analysis guidance: `/brag/assets/sfx/sfx-analysis.md` (selection guidance only).
- Exact SFX choice: filenames, timestamps, density and volume are chosen by the composition against the implemented animation.
- Audio files: music and all SFX copied into `brag-output/composition/assets/` (`assets/music/`, `assets/sfx/{keyboard,interface,impact,casino}/`). GSAP is vendored locally at `assets/vendor/gsap.min.js` — no network needed at render time.

## Hyperframes Instructions
Load `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes` and `hyperframes-cli`. /brag is its own workflow: do not enter the `hyperframes` intent interview and do not route into its generic promo/launch-video workflow.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render (video-scale type: 64–120 px headlines, 28–42 px body, 18–24 px labels).
- Keep the video within 15–25 seconds.
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet.
- Major reveals may move toward nearby strong cues within ~0.15 s (1–3 locks only). Smaller entrances snap to nearby beats within ~0.10 s. Readable sequential text snaps to every second beat, not every beat.
- Use SFX to support motion and interaction, with restraint.
- Honor the planned fade-in/fade-out music treatment.
- Audio-reactive: wire at least one element to the extracted band data (aurora warmth, card presence, lockup presence). No waveform/equalizer/notes/particles/strobe.
- Use local assets for audio and runtime dependencies.
- Run `hyperframes check` before render.
- Keep creation and rendering local; no publishing.

### Implementation notes (decided by Hyperframes)
- One `index.html` with a single root timeline `main`, five scene groups as `data-start`/`data-duration` clips, all animations as GSAP tweens on that timeline — no CSS keyframes, no runtime randomness, no fetches.
- Scenes are absolutely positioned full-frame groups; only the active scene is visible per its clip window, with scene-specific enter/exit so there are no blank gaps between clips.
- Audio-reactive sampling uses the per-frame `tl.call()` loop pattern; bass drives `opacity`/`scale` on glow layers only (3–6 % on text, 10–20 % on shapes).
- Performance budget: this machine has 4 cores and low free RAM, so backdrop-filter is limited to the single login glass card, and no full-screen blur or large-area filters.