# NANO BANANA PRO Studio

Vlastní studio pro generování a editaci obrázků přes Nano Banana Pro (Gemini 3 Pro Image) API.
Viz `docs/PRD.md` a `docs/API.md` pro plný produktový a API návrh.

Next.js aplikace (frontend + backend v jednom) se SQLite databází, určená k běhu jako trvalý
proces na jednom Mac Mini a používaná ze všech zařízení v síti (MacBook Pro + 2× Mac Mini) přes
prohlížeč.

## Lokální vývoj

```bash
npm install
cp .env.example .env   # vyplň GEMINI_API_KEY, APP_PASSWORD, APP_SECRET
npm run dev
```

Otevři [http://localhost:3000](http://localhost:3000) — appka tě přesměruje na `/login`, kde
zadáš heslo z `APP_PASSWORD`.

## Proměnné prostředí

Viz `.env.example` pro plný seznam a komentáře. Povinné jsou `APP_PASSWORD` a `APP_SECRET`;
`GEMINI_API_KEY` lze místo `.env` nastavit i přímo v UI (Nastavení → Provider).

## Nasazení na Mac Mini jako domácí server

1. **Node.js** — nainstaluj přes [nvm](https://github.com/nvm-sh/nvm) nebo Homebrew (`brew install node`).
2. **Zabraň uspání Mac Mini** — Předvolby systému → Baterie/Energy Saver → vypnout automatické
   uspání pro tento počítač (appka musí běžet trvale).
3. **Naklonuj repo a nastav `.env`:**
   ```bash
   git clone <repo-url> ~/nano-banana-pro
   cd ~/nano-banana-pro
   npm install
   cp .env.example .env   # a vyplň hodnoty
   npm run build
   ```
4. **Spusť přes pm2** (proces manager s auto-restartem):
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup   # vypíše příkaz pro launchd integraci — spusť ho, aby appka naběhla i po restartu
   ```
5. **Zjisti lokální adresu Mac Mini** (Předvolby systému → Síť, nebo `hostname`) a z ostatních
   zařízení v síti otevři `http://<hostname>.local:3000`.
6. **Přístup mimo domácí síť** — nainstaluj [Tailscale](https://tailscale.com) na Mac Mini i na
   MacBook Pro/druhý Mac Mini, přihlas se stejným účtem na všech zařízeních, pak appka půjde
   otevřít i mimo LAN přes Tailscale IP/hostname bez port-forwardingu.

### Update appky

```bash
cd ~/nano-banana-pro
git pull
npm install
npm run build
pm2 restart nano-banana-pro
```

### Záloha

SQLite databáze a uploadované/vygenerované obrázky žijí ve složce `storage/` (mimo git, viz
`.gitignore`). Zálohuj tuto složku pravidelně (Time Machine, `rsync` na NAS, cron job) —
je to jediná stavová část appky.

```bash
# Příklad: noční cron záloha na externí disk
0 3 * * * rsync -a ~/nano-banana-pro/storage/ /Volumes/Backup/nano-banana-pro-storage/
```

## Struktura projektu

```
src/app/(app)/        # chráněné stránky: Workspace, Historie, Presety, Nastavení
src/app/login/         # přihlašovací stránka
src/app/api/           # backend REST API (viz docs/API.md sekce 2)
src/app/storage/       # route servírující uploadnuté/vygenerované obrázky
src/lib/provider/       # ProviderAdapter + NanoBananaProAdapter (viz docs/API.md sekce 3)
src/lib/jobs.ts        # orchestrace jobů, in-process fronta, fan-out na provider
src/lib/db.ts          # SQLite schema a připojení
storage/                # SQLite DB + nahrané/vygenerované obrázky (negitované)
```
