# API kontrakt — NANO BANANA PRO Studio

Verze: 1.0 · Datum: 2026-09-25

Tento dokument popisuje dvě vrstvy API:

1. **Frontend ↔ Backend** — vlastní REST API, které volá Next.js frontend na vlastní Next.js
   backend (Route Handlers).
2. **Backend ↔ Provider** — jak backend interně volá Nano Banana Pro API. Tahle vrstva je schovaná
   za `ProviderAdapter` interface, aby šlo v budoucnu přidat další providery bez zásahu do
   frontendu.

> **Stav ověření (2026-09-25):** Sekce 3 níže je aktualizovaná podle aktuální oficiální Gemini API
> dokumentace (endpoint, auth, `imageConfig`, formát requestu/response). Dvě věci si přesto **znovu
> ověř těsně před implementací**, protože se často mění: (1) aktuální ceník za obrázek/rozlišení —
> viz `docs/PRD.md` sekce 10, a (2) rate limity pro tvůj konkrétní API klíč/tier. Adapter vrstva je
> navržená právě proto, aby případné budoucí změny API nezasáhly zbytek appky.

## 1. Autentizace

Všechny `/api/*` endpointy (kromě `/api/health`) vyžadují přihlášení. MVP řešení: session cookie
po zadání sdíleného hesla (`/api/auth/login`), middleware kontroluje session na všech ostatních
routách. API klíč providera se nikdy neposílá na frontend.

## 2. Frontend ↔ Backend API

### 2.1 `POST /api/jobs`

Vytvoří a zařadí nový generation job.

**Request** (`multipart/form-data`, protože obsahuje soubory):

| Pole | Typ | Povinné | Popis |
|---|---|---|---|
| `prompt` | string | ano | Textový prompt |
| `mode` | `text_to_image` \| `image_guided` \| `image_edit` | ano | |
| `resolution` | `1K` \| `2K` \| `4K` | ano | |
| `aspect_ratio` | `1:1` \| `3:4` \| `4:3` \| `16:9` \| `9:16` | ano | Kurátorovaný MVP výběr — provider (viz sekce 3) podporuje i `2:3`, `3:2`, `4:5`, `5:4`, `21:9`; jde jen o `enum` v backend validaci, přidání do UI nevyžaduje změnu adapteru |
| `output_count` | integer (1–4) | ano | Backend to realizuje jako `output_count` paralelních volání providera (viz sekce 3.3) |
| `input_images` | file[] (0–3) | ne | JPG/PNG/WEBP, posílají se providerovi jako base64 `inlineData` |
| `preset_id` | string \| null | ne | Pokud job vznikl z presetu |

**Response 201:**

```json
{
  "id": "job_01J...",
  "status": "queued",
  "estimated_cost_usd": 0.402,
  "created_at": "2026-09-25T10:00:00Z"
}
```

**Response 400** (validační chyba, např. víc než 3 vstupní obrázky nebo output_count mimo 1–4):

```json
{ "error": "output_count must be between 1 and 4" }
```

**Response 402** (pokud je zapnutý cost guardrail a job by ho překročil bez potvrzení):

```json
{
  "error": "cost_guardrail_exceeded",
  "estimated_cost_usd": 0.96,
  "threshold_usd": 0.5,
  "requires_confirmation": true
}
```

Frontend v tom případě zobrazí potvrzovací modal a job odešle znovu s `"confirm_cost": true`
v payloadu.

### 2.2 `GET /api/jobs/:id`

Vrací aktuální stav jobu. Frontend na tento endpoint pollinguje každé 2–3 s dokud
`status` není `completed` nebo `failed`.

**Response 200:**

```json
{
  "id": "job_01J...",
  "status": "completed",
  "prompt": "product shot of a red sneaker on white background",
  "mode": "image_guided",
  "resolution": "2K",
  "aspect_ratio": "1:1",
  "output_count": 2,
  "estimated_cost_usd": 0.268,
  "actual_cost_usd": 0.268,
  "input_images": [
    { "id": "img_in_1", "url": "/storage/uploads/job_01J/in_0.jpg" }
  ],
  "output_images": [
    { "id": "img_out_1", "url": "/storage/outputs/job_01J/out_0.png", "width": 2048, "height": 2048 },
    { "id": "img_out_2", "url": "/storage/outputs/job_01J/out_1.png", "width": 2048, "height": 2048 }
  ],
  "error_message": null,
  "created_at": "2026-09-25T10:00:00Z",
  "completed_at": "2026-09-25T10:00:42Z"
}
```

Protože každé volání providera vrací nejvýš 1 obrázek (viz sekce 3), backend při `output_count > 1`
spouští víc paralelních volání a **job může doběhnout i s `output_images.length < output_count`**
(např. 3 ze 4 se povedly). Status je v takovém případě stále `completed`, ale s `partial: true` a
`error_message` obsahujícím shrnutí, které dílčí generování selhalo:

```json
{
  "id": "job_01J...",
  "status": "completed",
  "partial": true,
  "output_count": 4,
  "output_images": [ /* jen 3 položky */ ],
  "error_message": "1 of 4 generations failed: provider rate limit (429)",
  "actual_cost_usd": 0.402
}
```

Stav `failed`:

```json
{
  "id": "job_01J...",
  "status": "failed",
  "error_message": "Provider rate limit exceeded, try again in 60s",
  "actual_cost_usd": 0,
  ...
}
```

### 2.3 `GET /api/jobs`

Historie jobů, stránkovaná.

**Query params:** `page` (default 1), `page_size` (default 20), `status` (volitelný filtr),
`from`, `to` (ISO datum).

**Response 200:**

```json
{
  "items": [ { "id": "job_01J...", "prompt": "...", "status": "completed", "resolution": "2K", "output_count": 2, "actual_cost_usd": 0.268, "created_at": "..." } ],
  "page": 1,
  "page_size": 20,
  "total": 137
}
```

### 2.4 `POST /api/jobs/:id/rerun`

Vytvoří nový job se stejnými parametry a vstupními obrázky jako referenční job.

**Response 201:** stejný tvar jako `POST /api/jobs`.

### 2.5 Presety

- `GET /api/presets` → seznam presetů.
- `POST /api/presets` → vytvoří preset z `{ name, prompt, resolution, aspect_ratio, output_count, mode }`.
- `DELETE /api/presets/:id` → smaže preset.
- `PATCH /api/presets/:id` → přejmenuje/upraví preset.

### 2.6 Nastavení

- `GET /api/settings` → vrací non-secret nastavení (výchozí hodnoty, cost guardrail threshold,
  aktivní provider). API klíč se v odpovědi **nikdy** nevrací v plném tvaru (jen `"api_key_set": true`
  případně posledních 4 znaky pro ověření).
- `PUT /api/settings` → update nastavení (defaulty, guardrail threshold).
- `PUT /api/settings/provider-key` → nastavení/rotace API klíče providera (write-only).

### 2.7 `GET /api/health`

Bez autentizace. Pro monitoring, že pm2/launchd proces žije.

```json
{ "status": "ok", "uptime_seconds": 123456 }
```

## 3. Backend ↔ Provider (Nano Banana Pro / Gemini 3 Pro Image)

### 3.1 Základní fakta o API

Nano Banana Pro **není** samostatné REST API se svým vlastním tvarem — je to model dostupný přes
obecné **Google Gemini `generateContent` API**. Klíčové vlastnosti, které přímo ovlivňují náš
`ProviderAdapter`:

- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
  kde `{model}` je `gemini-3-pro-image-preview` (stabilní alias `gemini-3-pro-image` je od 2026
  taky funkční se stejným pricingem — použít ten, pokud je dostupný na tvém API klíči).
- **Auth:** HTTP hlavička `x-goog-api-key: <GEMINI_API_KEY>` (alternativně `?key=` query param,
  ale hlavička je doporučená, aby klíč nekončil v access logech).
- **Volání je synchronní** — obrázek(y) se vrací přímo v HTTP response téhož requestu (žádné
  `submit job` + `poll status` na straně providera). U 4K generací trvá odezva typicky desítky
  sekund, proto backend request neblokuje frontend — viz 3.3.
- **1 request = nejvýš 1 vygenerovaný obrázek.** Provider nemá spolehlivý `n`/`candidateCount`
  parametr pro více obrázků v jednom volání u image modelů. Aby appka splnila požadavek na
  **1–4 výstupy najednou**, `NanoBananaProAdapter` musí vnitřně spustit `output_count` paralelních
  `generateContent` volání se stejným promptem, stejnými vstupními obrázky a stejným
  `imageConfig`, a výsledky poskládat dohromady (viz 3.3).
- **Vstupní obrázky** (0–3 v našem MVP) se posílají jako další `parts` ve stejném `contents[0]`
  objektu, formou `inlineData` (base64 + MIME typ) — ne jako samostatný upload endpoint. Provider
  podporuje až ~14 referenčních obrázků, takže náš limit 3 je čistě produktové rozhodnutí, ne
  technický strop.
- **Limit velikosti requestu:** cca 20 MB na celý request (text + base64 obrázky dohromady). Při
  3 vstupních fotkách v rozumném rozlišení se do toho běžně vejdeme; kdyby ne, řešením je zmenšit
  vstupy před odesláním (resize na backendu), ne Files API (zbytečná komplexita pro MVP).
- **Podporované `imageSize` hodnoty:** `1K`, `2K`, `4K` — přesně odpovídá naší volbě rozlišení.
- **Podporované `aspectRatio` hodnoty u modelu:** `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`,
  `9:16`, `16:9`, `21:9`. MVP UI vystavuje jen podmnožinu (`1:1`, `3:4`, `4:3`, `16:9`, `9:16`),
  zbytek lze přidat čistě úpravou frontend enumu, adapter je zvládne beze změny.

### 3.2 Tvar requestu a response

**Request:**

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        { "text": "product shot of a red sneaker on white background, studio lighting" },
        { "inlineData": { "mimeType": "image/jpeg", "data": "<BASE64_INPUT_IMAGE_1>" } }
      ]
    }],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"],
      "imageConfig": {
        "aspectRatio": "1:1",
        "imageSize": "2K"
      }
    }
  }'
```

- `parts` může obsahovat 0–3 `inlineData` bloků (naše input obrázky) v libovolném pořadí vůči
  textu; první `text` part obsahuje prompt.
- `responseModalities` musí obsahovat `"IMAGE"`, jinak model vrátí jen text.

**Response (zjednodušeno, `data` zkráceno):**

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          { "inlineData": { "mimeType": "image/png", "data": "iVBORw0KGgoAAAANSUhEUgAA..." } }
        ]
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "candidatesTokenCount": 2000,
    "totalTokenCount": 2131
  }
}
```

Adapter najde vygenerovaný obrázek jako `candidates[0].content.parts[].inlineData` (part s
`inlineData`, ne `text`), dekóduje base64 do `Buffer` a uloží na disk.

### 3.3 `ProviderAdapter` rozhraní

```ts
interface ProviderAdapter {
  estimateCost(params: GenerationParams): number;
  /** Vnitřně fan-outuje outputCount paralelních volání providera a agreguje výsledek. */
  generate(
    params: GenerationParams,
    inputImages: { buffer: Buffer; mimeType: string }[]
  ): Promise<ProviderGenerationResult>;
}

interface GenerationParams {
  prompt: string;
  mode: "text_to_image" | "image_guided" | "image_edit";
  resolution: "1K" | "2K" | "4K";
  aspectRatio: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
  outputCount: 1 | 2 | 3 | 4;
}

interface ProviderGenerationResult {
  outputs: { buffer: Buffer; mimeType: string }[]; // 0..outputCount položek
  succeededCount: number;
  failedCount: number;
  actualCostUsd: number; // součet ceny jen za skutečně úspěšné výstupy
  errors: string[]; // čitelné chyby z neúspěšných dílčích volání, pokud nějaká byla
}
```

`NanoBananaProAdapter.generate()`:

1. Sestaví `contents`/`generationConfig` payload jednou (prompt, input images, `imageConfig`).
2. Spustí `Promise.allSettled` s `outputCount` kopiemi téhož `generateContent` volání
   (s malým jitterem mezi starty, aby se nenarazilo na burst rate limit).
3. Z úspěšných odpovědí vytáhne `inlineData` obrázky, z neúspěšných posbírá chybové hlášky.
4. Vrátí agregovaný `ProviderGenerationResult` — **backend job** (naše vlastní `GenerationJob`
  entita) se pak označí `completed` (i při částečném úspěchu, viz sekce 2.2) nebo `failed`
  (pokud selhaly úplně všechny dílčí výstupy).

**Interní fronta jobů (backend):** `queued`/`processing`/`completed`/`failed` v sekci 2.2 je stav
**naší** `GenerationJob` entity v SQLite, ne stav u providera (ten je synchronní, žádný job na
jeho straně neexistuje). Frontend pollinguje náš backend; backend uvnitř zpracování jednoho jobu
dělá výše popsaný fan-out. Pro jednoho uživatele s max. 4 paralelními voláními na job není potřeba
Redis/BullMQ — stačí jednoduchá in-process fronta (např. limit 1–2 jobů zpracovávaných zároveň).

## 4. Chybové kódy (shrnutí)

| HTTP status | Kdy |
|---|---|
| 400 | Validační chyba vstupu (chybí prompt, špatný počet obrázků, neplatný resolution/ratio) |
| 401 | Nepřihlášeno |
| 402 | Cost guardrail — vyžaduje potvrzení |
| 404 | Job/preset neexistuje |
| 429 | Provider rate limit — appka job automaticky zařadí zpět do fronty s retry |
| 500 | Neočekávaná chyba backendu nebo providera |

## 5. Bezpečnostní poznámky

- API klíč providera se čte pouze server-side z DB/`.env`, nikdy se neposílá do browseru.
- Upload endpoint validuje MIME typ a velikost před uložením na disk.
- Middleware chrání všechny `/api/*` (kromě `/api/health`) session cookie.
- Doporučeno provozovat za Tailscale (šifrovaný přenos mezi zařízeními) i v rámci LAN.
