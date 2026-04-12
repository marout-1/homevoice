# 🏠 HomeVoice

**Turn any U.S. property address into a professional AI-generated podcast.**

HomeVoice is an MVP web app for real estate marketing teams. Enter a property address and receive a downloadable ~3-minute podcast covering:

- Home valuation (Zillow Zestimate)
- Recent comparable sales
- Local market trends and news
- A bullish/bearish/neutral market outlook

---

## How it works

1. Enter a U.S. property address + your company name
2. Click **Generate Podcast**
3. The app fetches property data → pulls local market news → writes a podcast script with Claude → converts it to audio with ElevenLabs
4. Play in-browser or download the MP3

---

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your API keys

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in at minimum:

| Key | Purpose | Where to get it |
|-----|---------|-----------------|
| `ANTHROPIC_API_KEY` | **Required** — generates the podcast script | [console.anthropic.com](https://console.anthropic.com) |
| `RAPIDAPI_KEY` | Property data (Zillow) | [rapidapi.com](https://rapidapi.com) → search "Zillow56" |
| `ELEVENLABS_API_KEY` | AI voice / audio | [elevenlabs.io](https://elevenlabs.io) |
| `SERPER_API_KEY` | Local market news | [serper.dev](https://serper.dev) |

The app runs without all keys — it uses realistic demo data for missing sources and skips audio if no TTS key is provided.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (follow the prompts)
vercel

# Add your environment variables in the Vercel dashboard:
# Project → Settings → Environment Variables
```

Or click **Import Project** in the [Vercel dashboard](https://vercel.com/new) and import the GitHub repo. Then add your environment variables under Settings → Environment Variables.

---

## Project structure

```
app/
  page.tsx              # Main UI — address input, progress, player, script
  layout.tsx            # App shell and metadata
  api/
    generate/
      route.ts          # Main API endpoint — orchestrates all steps
  lib/
    property.ts         # Property data fetching (Zillow → Rentcast → demo)
    market.ts           # Local market news (Serper → Tavily → demo)
    script.ts           # Claude podcast script generation
    audio.ts            # TTS audio (ElevenLabs → OpenAI → skip)
.env.example            # Template for all required environment variables
```

---

## API pipeline

```
POST /api/generate
  { address: string, brandName: string }

  Step 1 → getPropertyData()    Zillow API → Rentcast → demo stub
  Step 2 → getMarketContext()   Serper → Tavily → demo stub
  Step 3 → generateScript()     Claude claude-sonnet-4-6
  Step 4 → generateAudio()      ElevenLabs → OpenAI TTS → null

  Returns: { property, script, audio: { base64Mp3 } }
```

---

## Known limitations

- **Zillow rate limits**: RapidAPI free tier limits queries. If you hit limits, Rentcast is a more reliable fallback.
- **Audio length**: ElevenLabs free tier has a monthly character limit. A single podcast is ~1,500–2,000 characters.
- **No session storage**: Podcasts are not saved. Refresh = lost. (Auth + history is a v2 feature.)
- **Demo mode**: Without API keys, the app uses hardcoded demo property data so you can test the full UI flow.
- **Comp data**: Zillow comps quality varies by market. Some addresses return few or no comps.
- **60–90 second generation time**: The pipeline makes 4+ external API calls sequentially. This is expected for MVP.

---

## Disclaimer

This application is for informational and marketing purposes only. Zestimates and AI-generated content are not professional appraisals or financial advice.
