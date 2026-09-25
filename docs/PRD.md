# PRD — NANO BANANA PRO Studio

Verze: 1.0 · Datum: 2026-09-25

## 1. Přehled produktu

NANO BANANA PRO Studio je vlastní webová aplikace pro generování a editaci obrázků nad modelem
Nano Banana Pro (Gemini 3 Pro Image) přes oficiální API. Cílem je mít plnou kontrolu nad promptem,
vstupními obrázky, rozlišením, poměrem stran a počtem výstupů — bez uměle vnucených limitů
produktů třetích stran (typu EverArt/EverBot), a to v rozhraní, které je dostupné ze všech
uživatelových zařízení bez instalace.

Aplikace je určena pro **jednoho uživatele** (vlastníka) používaného ze tří zařízení v jedné
domácí/kancelářské síti: MacBook Pro + 2× Mac Mini. Není to tedy víceuživatelský SaaS produkt —
je to osobní nástroj, jehož architektura tomu má odpovídat (žádný zbytečný multi-tenant, billing
pro třetí strany apod.).

## 2. Cíl a rozsah

**Primární cíl:** Rychle generovat 1–4 obrázkové výstupy na základě textového promptu a 0–3
zdrojových obrázků, s volbou rozlišení (1K/2K/4K) a poměru stran, a mít přehlednou historii a
presety pro opakované použití.

**Sekundární cíl:** Architektura má být připravená na budoucí rozšíření (další provider, další
zařízení, případně sdílení s dalším uživatelem), ale MVP se drží úzkého scope.

## 3. Uživatel

- Vlastník aplikace, power user, používá appku z MacBook Pro (mobilně i doma) a ze dvou Mac Mini
  (stacionárně, v lokální síti).
- Chce konzistentní historii a presety napříč zařízeními → data musí žít na jednom centrálním
  místě (serveru), ne lokálně na každém zařízení zvlášť.
- Chce vidět/mít kontrolu nad náklady (API se platí za generaci).

## 4. Provozní model (klíčové rozhodnutí)

Aplikace běží jako **Node.js/Next.js server na jednom z Mac Mini** („domácí server“), který je:

- spuštěný trvale (Mac Mini nikdy neusíná — nastavit v Energy Saver „Prevent automatic sleeping“),
- dostupný z MacBook Pro a druhého Mac Mini přes lokální síť (`http://<hostname>.local:PORT`
  přes Bonjour/mDNS, případně statická lokální IP),
- dostupný i mimo domácí síť (např. MacBook Pro na cestách) přes **Tailscale** — bezpečná privátní
  síť mezi vlastními zařízeními bez nutnosti port-forwardingu nebo veřejné IP,
- spravovaný přes `pm2` (proces manager, auto-restart při pádu) a macOS `launchd` LaunchAgent
  (auto-start po restartu Mac Mini).

Tím pádem je aplikace fakticky nasazená jednou a používaná ze všech tří zařízení přes prohlížeč,
se sdílenou historií, presety a úložištěm obrázků na jednom místě.

Zálohování: SQLite databázový soubor + složka s uploadovanými/vygenerovanými obrázky se pravidelně
zálohují (např. `cron` job na Mac Mini kopírující do Time Machine cílové složky nebo do cloudového
úložiště).

## 5. MVP scope

### In scope

- Textové prompt pole (povinné).
- Upload 0–3 vstupních obrázků (JPG/PNG/WEBP), drag & drop.
- Volba rozlišení: **1K / 2K / 4K**.
- Volba poměru stran: **1:1, 3:4, 4:3, 16:9, 9:16** (podle toho, co API skutečně podporuje —
  ověřit v `docs/API.md` sekci Provider capabilities před implementací).
- Volba počtu výstupů: **1–4** generovaných obrázků najednou.
- Režimy: text-to-image (bez vstupního obrázku) a image-guided/edit (s 1–3 vstupy).
- Odhad ceny (estimated cost) před spuštěním jobu, podle aktuálního ceníku providera.
- Galerie výsledků s downloadem (jednotlivě i hromadně), „re-run“, „use as input“.
- Historie všech jobů (prompt, parametry, cena, stav, čas) — perzistentní, sdílená napříč
  zařízeními.
- Presety (uložený prompt + parametry pro opakované workflow).
- Nastavení: API klíč providera, výchozí hodnoty, cenové limity/varování.

### Out of scope (MVP)

- Více uživatelů / týmová spolupráce / role a oprávnění.
- Veřejné sdílení galerií.
- Pokročilé maskování / lokální retuš v editoru.
- Více providerů současně (architektura na to bude připravená, ale MVP má jednoho providera).
- Fakturační/platební systém — jde o sledování nákladů, ne o zpracování plateb.

## 6. Funkční požadavky

### 6.1 Workspace (hlavní obrazovka)

- Vlevo/nahoře: prompt textarea, upload zóna pro 0–3 obrázky s náhledy a možností smazat.
- Parametry: resolution (1K/2K/4K), aspect ratio, počet výstupů (1–4), mode.
- Živě dopočítávaný **odhad ceny** podle zvolených parametrů.
- Tlačítko „Generate“; po odeslání se job zařadí do fronty a zobrazuje stav
  (queued → processing → completed/failed).
- Vpravo/dole: výsledky aktuálního jobu, jakmile jsou hotové.

### 6.2 Vstupní obrázky

- Podporované formáty: JPG, PNG, WEBP.
- Maximální velikost souboru konfigurovatelná (výchozí např. 15 MB/soubor).
- Validace počtu (0–3) na frontendu i backendu.
- Náhledy před odesláním, možnost odebrat jednotlivý vstup.

### 6.3 Generování

- Job se odešle na backend, backend zavolá Nano Banana Pro API (viz `docs/API.md`).
- Zpracování asynchronní: backend job persistuje do SQLite se stavem `queued`, frontend
  pollinguje `GET /api/jobs/:id` každé 2–3 s do dokončení.
- Chybové stavy (rate limit, timeout, invalid input) se ukládají do jobu s čitelnou chybovou
  hláškou a nespotřebovávají odhadovanou cenu, pokud provider joby při chybě neúčtuje.

### 6.4 Výsledky a galerie

- Grid výsledných obrázků (1–4 dlaždice podle output_count).
- Každá dlaždice: náhled, resolution, aspect ratio, download tlačítko.
- Akce nad celým jobem: „Re-run se stejnými parametry“, „Použít výstup jako nový vstup“,
  „Zkopírovat prompt“.

### 6.5 Historie

- Chronologický seznam všech jobů, filtrovatelný podle data, stavu, resolution.
- Klik na položku historie → načte prompt a parametry zpět do workspace (bez automatického
  spuštění).

### 6.6 Presety

- Uložení aktuální kombinace (prompt + parametry) pod named presetem.
- Rychlé načtení presetu do workspace.
- Mazání/přejmenování presetů.

### 6.7 Nastavení

- API klíč providera (uložený server-side, nikdy neopouští backend).
- Výchozí resolution/aspect ratio/output count pro nový job.
- Volitelný „cost guardrail“: varování nebo tvrdé zablokování jobů nad určitou odhadovanou cenu
  (např. blokovat 4K × 4 výstupy bez potvrzení).

## 7. Nefunkční požadavky

- API klíč nesmí být nikdy vystaven na frontendu (žádný `NEXT_PUBLIC_*` env s klíčem).
- Přístup k appce chráněný jednoduchým přihlášením (jeden účet, případně jen sdílené heslo přes
  middleware) — appka běží v privátní síti/Tailscale, ale základní ochrana je žádoucí, protože
  účtuje reálné peníze za API volání.
- Aplikace musí přežít restart Mac Mini (launchd auto-start) a pád procesu (pm2 auto-restart).
- Perzistence dat musí být odolná — SQLite soubor mimo `node_modules`/build složky, zahrnutý do
  zálohy.
- UI musí fungovat plynule na desktopu (primární) i mobilně (Safari na MacBooku při použití mimo
  domácí síť přes Tailscale).

## 8. Technický stack

| Vrstva | Volba | Poznámka |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | SSR/CSR hybrid, jeden deployment celek s backendem |
| Backend | Next.js API routes (Route Handlers) | Žádný samostatný server proces navíc |
| Databáze | SQLite (`better-sqlite3` nebo Prisma + SQLite adapter) | Jeden soubor, žádný DB server; pro 1 uživatele plně dostačující |
| Fronta jobů | Jednoduchá in-process/DB-backed fronta (bez Redis/BullMQ) | Nízký objem requestů (1 uživatel) nevyžaduje distribuovanou frontu; zjednodušení oproti původnímu návrhu |
| File storage | Lokální disk Mac Mini (`storage/uploads/`, `storage/outputs/`) | Zahrnuto do zálohy; případně později přesun na NAS/cloud |
| Proces management | `pm2` | Auto-restart, logy, `pm2 startup` integrace s launchd |
| Autostart | macOS `launchd` LaunchAgent (přes `pm2 startup`) | Přežije restart Mac Mini |
| Vzdálený přístup | Tailscale | Bezpečný přístup z MacBook Pro mimo domácí síť, bez port-forwardingu |
| Provider abstraction | Vlastní `ProviderAdapter` interface | MVP implementuje jen Nano Banana Pro adapter, ale rozhraní je obecné |

Poznámka ke zjednodušení oproti dřívějšímu konceptu: Redis/BullMQ a Postgres dávaly smysl pro
víceuživatelský SaaS produkt. Pro jednoho uživatele na domácím serveru je SQLite + jednoduchá
in-process fronta dostatečně robustní a výrazně snižuje provozní zátěž (nic navíc neběží, nic
navíc se nezálohuje).

## 9. Datový model

### 9.1 Entity

- `User` — v MVP jeden řádek (vlastník), do budoucna připraveno na víc.
- `GenerationJob` — jedna generace (1 prompt + parametry → 1–4 výstupy).
- `GenerationInputImage` — vstupní obrázek navázaný na job.
- `GenerationOutputImage` — výstupní obrázek navázaný na job.
- `Preset` — uložená kombinace promptu a parametrů.
- `ProviderConfig` — konfigurace API providera (klíč, ceník, endpoint).
- `BillingRecord` — záznam skutečné ceny za dokončený job (pro reporting).

### 9.2 `GenerationJob`

| Pole | Typ | Popis |
|---|---|---|
| `id` | TEXT (UUID) PK | |
| `prompt` | TEXT | |
| `mode` | TEXT | `text_to_image` \| `image_guided` \| `image_edit` |
| `resolution` | TEXT | `1K` \| `2K` \| `4K` |
| `aspect_ratio` | TEXT | `1:1` \| `3:4` \| `4:3` \| `16:9` \| `9:16` |
| `output_count` | INTEGER | 1–4 |
| `input_image_count` | INTEGER | 0–3 |
| `status` | TEXT | `queued` \| `processing` \| `completed` \| `failed` |
| `error_message` | TEXT NULL | |
| `provider_name` | TEXT | např. `nano_banana_pro` |
| `provider_job_id` | TEXT NULL | ID jobu u providera (pokud async) |
| `estimated_cost_usd` | REAL | |
| `actual_cost_usd` | REAL NULL | |
| `preset_id` | TEXT NULL FK | pokud spuštěno z presetu |
| `created_at` | DATETIME | |
| `completed_at` | DATETIME NULL | |

### 9.3 `GenerationInputImage` / `GenerationOutputImage`

| Pole | Typ | Popis |
|---|---|---|
| `id` | TEXT (UUID) PK | |
| `job_id` | TEXT FK → GenerationJob | |
| `file_path` | TEXT | relativní cesta ve `storage/` |
| `width` / `height` | INTEGER NULL | |
| `order_index` | INTEGER | pořadí (0–2 pro input, 0–3 pro output) |
| `created_at` | DATETIME | |

### 9.4 `Preset`

| Pole | Typ |
|---|---|
| `id` | TEXT (UUID) PK |
| `name` | TEXT |
| `prompt` | TEXT |
| `resolution` | TEXT |
| `aspect_ratio` | TEXT |
| `output_count` | INTEGER |
| `mode` | TEXT |
| `created_at` | DATETIME |

### 9.5 `ProviderConfig`

| Pole | Typ |
|---|---|
| `id` | TEXT PK |
| `provider_name` | TEXT |
| `api_key_encrypted` | TEXT |
| `pricing_json` | TEXT (JSON) |
| `is_active` | BOOLEAN |

## 10. Pricing / billing logika

Ceny se u API providerů mění a liší se podle tieru (Standard vs. Batch/Flex). Aplikace **nesmí mít
ceník natvrdo zadrátovaný v kódu** — musí ho číst z konfigurace (`ProviderConfig.pricing_json`),
kterou lze upravit v Nastavení, protože se ceny mění a je třeba je občas ověřit přímo u providera
před spuštěním produkce.

**Výchozí orientační hodnoty pro konfiguraci (ověřit aktuální ceník před nasazením):**

| Rozlišení | Standard / výstup | Batch/Flex / výstup |
|---|---:|---:|
| 1K | ~$0.134 | ~$0.067 |
| 2K | ~$0.134 | ~$0.067 |
| 4K | ~$0.24 | ~$0.12 |

Vzorec:

```
estimated_cost_usd = unit_output_price(resolution, tier) × output_count
                    + unit_input_price × input_image_count   // pokud provider input účtuje
```

Pravidla:

- Před odesláním jobu se v UI zobrazí `estimated_cost_usd`.
- Po dokončení se uloží `actual_cost_usd` (pokud provider vrací skutečnou cenu; jinak se rovná
  odhadu).
- Failed joby: pokud provider u chyby nevrací poplatek, `actual_cost_usd = 0`.
- Cost guardrail v Nastavení: práh, nad kterým appka vyžaduje potvrzení (např. modal „Tento job
  bude stát ~$0.96, pokračovat?“).

## 11. UX pravidla

- Celý hlavní workflow (prompt → vstupy → parametry → generate) musí jít provést na jedné
  obrazovce bez modálů.
- Cena se přepočítává živě při každé změně parametrů.
- 4K a/nebo 4 výstupy současně mají vizuální upozornění na vyšší cenu.
- Historie je vždy jedno kliknutí od workspace (postranní panel nebo záložka).
- Po dokončení jobu je download k dispozici okamžitě, bez nutnosti přecházet jinam.

## 12. Rizika

- Změny cen/parametrů API providera vyžadují update `pricing_json` v konfiguraci — nepsat ceny
  do kódu natvrdo.
- Mac Mini jako jediný server = single point of failure; zmírněno pravidelnou zálohou SQLite +
  storage složky.
- Dostupnost mimo domácí síť závisí na Tailscale — je třeba mít nainstalováno na všech třech
  zařízeních.
- Rate limity/timeouty API providera — backend musí mít rozumné retry/timeout chování a joby
  nesmí appku „zaseknout“.

## 13. Roadmapa

**Fáze 1 — MVP** (viz scope výše): Workspace, výsledky, historie, presety, cost estimate, jeden
provider adapter, běh na Mac Mini.

**Fáze 2:** Druhý provider adapter (fallback při výpadku), vylepšené editační nástroje, mobilní
PWA vrstva pro pohodlnější použití z MacBooku mimo domácí síť.

**Fáze 3:** Volitelné sdílení s dalším uživatelem (rodina/kolega) s odděleným billing přehledem,
pokud vznikne potřeba.

## 14. Související dokumenty

- `docs/API.md` — detailní API kontrakt (frontend↔backend i backend↔provider), datové payloady.
