# Rythu Mitra — రైతు మిత్ర

**Vernacular-first AI business companion for Telugu-speaking farmers.**

Chat-native farm management for India's 150M+ Telugu-speaking farmers. Voice to AI to Structured Records. Open source, offline-capable, designed with love.

> "WhatsApp is for your life. This is for your livelihood."

## What is Rythu Mitra?

Rythu Mitra (రైతు మిత్ర = "Farmer's Friend") is an AI-powered farm management app built specifically for Telugu-speaking farmers in Andhra Pradesh and Telangana. It understands Telugu voice input, tracks expenses and income, shows real-time mandi prices, and provides proactive farming intelligence — all on a Rs 10,000 phone over a 3G connection.

### Built for Lakshmi

Our design persona is Lakshmi, 38, a groundnut and cotton farmer from Anantapur district. She manages 4 acres of dryland farming, pays laborers in cash, sells at the local mandi, and tracks everything in her head. Rythu Mitra gives her a digital memory that speaks her language.

## Features

- Telugu Voice Input — Say "కూలి 1000" and it records Rs 1,000 labor expense
- AI Chat (Sarvam 105B) — Conversational interface in Telugu with live database context
- Expense and Income Tracking — All money in integer paise, balance never stored (always computed)
- Mandi Price Feed — Real-time market prices with MSP comparison across mandis
- Crop Diary — Field events: planting, spraying, irrigation, pest observations, harvest
- Bill OCR — Photograph dealer bills; AI extracts amounts automatically
- Web Search — Agricultural knowledge with Telugu KB + DuckDuckGo + Sarvam fallback
- Persistent Memory — AI remembers farmer preferences, patterns, and concerns
- 30-second Undo — Every financial action is reversible
- Government Schemes — PM-KISAN, YSR Rythu Bharosa status tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Svelte 5, TypeScript, Vite |
| **Database** | SpacetimeDB (real-time sync, offline-capable) |
| **AI** | Sarvam AI (105B chat, STT, TTS, translation) |
| **Design** | Matti Design System (earth palette for farming context) |
| **Intelligence** | Ananta engine (digital root classifier, 4 validation gates, pattern detection) |

## Quick Start

### Prerequisites
- Node.js 18+
- A [Sarvam AI](https://sarvam.ai) API key (free tier available)

### Run the client
```bash
cd client
npm install
npm run dev
```

The app connects to the live SpacetimeDB instance on `maincloud.spacetimedb.com`. Enter your Sarvam API key in Settings to enable AI features.

### Run the STDB module (optional — for local development)
```bash
cd module/spacetimedb
npm install
npm run build
npm run publish
npm run generate  # regenerate TypeScript bindings
```

## Project Structure

```
rythu_mitra/
├── client/                 # Svelte 5 frontend
│   ├── src/
│   │   ├── components/     # UI components (ChatPanel, ConfirmCard, etc.)
│   │   ├── screens/        # App screens (Home, Dabbu, Market, Panta, Settings)
│   │   ├── lib/            # Core logic
│   │   │   ├── ananta.ts   # Intelligence engine (digital root, validation gates)
│   │   │   ├── actions.ts  # CRUD action routing + execution
│   │   │   ├── chat.ts     # SSE streaming chat engine
│   │   │   ├── context.ts  # Dynamic system prompt builder
│   │   │   ├── voice.ts    # Telugu expense parsing (70+ keywords)
│   │   │   ├── search.ts   # Multi-provider web search
│   │   │   ├── memory.ts   # Persistent AI memory system
│   │   │   └── ...
│   │   └── module_bindings/ # Auto-generated SpacetimeDB bindings
│   └── ...
├── module/                 # SpacetimeDB server module
│   └── spacetimedb/
│       └── src/index.ts    # 13 tables, 18 reducers, views
├── features/               # Feature contracts & sprint logs
├── decisions/              # Architecture Decision Records
├── uiux-mockups/           # Design mockups
├── scripts/                # Dev utility scripts
└── docs/                   # Documentation
```

## Architecture Principles

1. **Balance is NEVER stored** — always computed from `money_events` (Phase 18 invariant)
2. **All money is integer paise** — no floating point, ever (Rs 1 = 100 paise)
3. **Idempotency on financial writes** — SHA256-based duplicate prevention
4. **Telugu-first** — 70+ keywords, fraction amounts (ఒకటిన్నర = 1.5), verb conjugations
5. **Offline-capable** — local fallback data, localStorage persistence, sync when online
6. **AI with guardrails** — 4 validation gates (sanity, consistency, duplicate, quality)

## Testing

```bash
cd client
npm run build        # Production build (zero errors)
npx vitest run       # 358 tests, all passing
npx svelte-check     # Type check (0 errors, 0 warnings)
```

## Contributing

Contributions welcome! This project serves real farmers — please be thoughtful about:
- **Telugu accuracy** — verify keywords with native speakers
- **Offline behavior** — test without network connectivity
- **Low-end devices** — target Rs 10,000 Android phones (2GB RAM, 3G)
- **Financial correctness** — money operations must be exact (integer paise)

## License

[Apache 2.0](LICENSE)

## Acknowledgements

Built by [Asymmetrica](https://github.com/sarat-asymmetrica) with:
- [Sarvam AI](https://sarvam.ai) — Indian AI models (Telugu STT, chat, TTS, translation)
- [SpacetimeDB](https://spacetimedb.com) — Real-time database with offline sync
- [Svelte](https://svelte.dev) — Reactive UI framework

---

**Om Lokah Samastah Sukhino Bhavantu**
*May all farmers benefit from technology that speaks their language.*
