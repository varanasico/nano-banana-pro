# API kontrakt — NANO BANANA PRO Studio

Verze: 1.0 · Datum: 2026-09-25

Tento dokument popisuje dvě vrstvy API:

1. **Frontend ↔ Backend** — vlastní REST API, které volá Next.js frontend na vlastní Next.js
   backend (Route Handlers).
2. **Backend ↔ Provider** — jak backend interně volá Nano Banana Pro API. Tahle vrstva je schovaná
   za `ProviderAdapter` interface, aby šlo v budoucnu přidat další providery bez zásahu do
   frontendu.

> **Poznámka k ověření:** Přesné názvy polí a chování Nano Banana Pro API (sync vs. async, přesný
> formát response, limity velikosti vstupních obrázků) je nutné ověřit v aktuální oficiální
> dokumentaci providera před implementací `NanoBananaProAdapter` — veřejně dostupné popisy se
> mezi zdroji mírně liší a API se může měnit. Adapter vrstva je navržená právě proto, aby tahle
> ověření/změny nezasáhly zbytek appky.

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
| `aspect_ratio` | `1:1` \| `3:4` \| `4:3` \| `16:9` \| `9:16` | ano | |
| `output_count` | integer (1–4) | ano | |
| `input_images` | file[] (0–3) | ne | JPG/PNG/WEBP |
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

## 3. Backend ↔ Provider (Nano Banana Pro)

Backend implementuje `ProviderAdapter`:

```ts
interface ProviderAdapter {
  estimateCost(params: GenerationParams): number;
  submitJob(params: GenerationParams, inputFiles: Buffer[]): Promise<ProviderJobHandle>;
  getJobStatus(handle: ProviderJobHandle): Promise<ProviderJobResult>;
}

interface GenerationParams {
  prompt: string;
  mode: "text_to_image" | "image_guided" | "image_edit";
  resolution: "1K" | "2K" | "4K";
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  outputCount: 1 | 2 | 3 | 4;
}

interface ProviderJobResult {
  status: "processing" | "completed" | "failed";
  outputs: { buffer: Buffer; width: number; height: number }[];
  actualCostUsd?: number;
  errorMessage?: string;
}
```

`NanoBananaProAdapter` implementuje toto rozhraní voláním skutečného Nano Banana Pro API
(REST/HTTPS, autentizace API klíčem v hlavičce). Konkrétní request/response tvar providera se
mapuje na `ProviderJobResult` uvnitř adapteru — zbytek appky s tím nepracuje přímo.

**Interní fronta jobů (backend):** jednoduchá in-process fronta v Next.js backendu
(např. pole/DB tabulka se stavy `queued`/`processing`, zpracováváno sekvenčně nebo s malým
paralelismem 1–2 jobů najednou) — pro jednoho uživatele není potřeba Redis/BullMQ.

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
