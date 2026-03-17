# F005 — Morning Briefing (Home Screen)

**Status:** ✅ Live
**Wave:** 1 (Core Loop)
**Owner:** Commander + Claude
**Created:** 2026-03-16

---

## 1. User Story

As **Lakshmi** (38, Anantapur, groundnut farmer),
I want to **open the app at 5 AM and immediately see today's mandi prices for my crops, my current balance, and any alerts**,
so that **I start my day informed without searching for anything**.

---

## 2. Acceptance Criteria

- [ ] AC1: Home screen loads with live data from STDB (not mock data)
- [ ] AC2: Balance strip shows computed balance (income - expenses) from money_events
- [ ] AC3: Season ring shows current season stage from farmer_context
- [ ] AC4: Briefing cards show mandi prices for farmer's crops in her district
- [ ] AC5: Price comparison bars animate with spring easing (987ms)
- [ ] AC6: Cards stagger in with 21ms per element delay
- [ ] AC7: Welcome toast in Telugu: "శుభోదయం! X కొత్త అప్‌డేట్‌లు"
- [ ] AC8: All data reactive — updates in real-time when STDB rows change
- [ ] AC9: Offline: shows last cached data with "ఆఫ్‌లైన్" indicator

---

## 3. Full-Stack Contract

### 3a. Schema (STDB Module — F001, already live)

Tables subscribed: `farmer`, `farmer_context`, `money_event`, `market_price`
Views used: `farmer_balance` (computed income/expense totals)

No schema changes. This feature is pure client-side wiring.

### 3b. Client (Svelte + Tauri)

**Modified components:**

| Component | Change |
|-----------|--------|
| `db.ts` | REWRITE — Activate real STDB connection, generate bindings, setup subscriptions |
| `stores.ts` | REWRITE — Replace mock data with live STDB table stores |
| `Home.svelte` | MODIFY — Bind to live stores instead of hardcoded mock data |
| `BalanceStrip.svelte` | MODIFY — Derive from farmer_balance view |
| `BriefingCard.svelte` | MODIFY — Accept live market_price data as props |
| `App.svelte` | MODIFY — Call connect() on mount, show connection status |

**STDB Subscriptions:**

```sql
SELECT * FROM farmer WHERE identity = :sender
SELECT * FROM farmer_context WHERE farmer_id = :sender
SELECT * FROM money_event WHERE farmer_id = :sender
SELECT * FROM market_price
```

**Derived stores:**

```typescript
// Balance (from money_events, NEVER stored)
balance = derived(moneyEvents, events => {
  const income = events.filter(e => e.isIncome).reduce((sum, e) => sum + e.amountPaise, 0n);
  const expense = events.filter(e => !e.isIncome).reduce((sum, e) => sum + e.amountPaise, 0n);
  return { income, expense, net: income - expense };
});

// My crop prices (filtered from all market_prices by farmer's crops + district)
myCropPrices = derived([marketPrices, farmerContext], ([prices, ctx]) => {
  if (!ctx) return [];
  const crops = JSON.parse(ctx.crops || '[]');
  return prices.filter(p => crops.includes(p.crop) && p.district === farmer.district);
});
```

### 3c. Design (Living Geometry / Matti)

Already implemented in F002 mockup port. This feature wires live data to existing components.
- Balance counter animation: count-up over 987ms with ease-out-cubic
- Price bars: spring animation (987ms, cubic-bezier(0.34, 1.56, 0.64, 1))
- Card stagger: 21ms per element, cap at 144ms

### 3d. AI Integration

None for F005. Morning briefing is pure data display.

---

## 4. Dependencies

- **Requires:** F001 (✅ Live), F002 (✅ Live), STDB module published
- **Blocks:** Nothing directly

---

## 5. Architecture Notes

### STDB Generate Bindings

After publishing, generate TypeScript bindings:
```bash
cd rythu_mitra/module
npm run generate
# → Creates ../../client/src/module_bindings/
```

This generates typed classes for every table, reducer, and procedure.
The client imports from `module_bindings/` instead of manually typing.

### Seeding mock data for demo

After publish, seed via STDB SQL or a dedicated seed reducer:
- 1 farmer (Lakshmi demo account)
- 10 money_events (mix of income/expenses, various kinds)
- 5 market_prices (groundnut + cotton in Anantapur/Kurnool)
- 1 farmer_context (crops: groundnut+cotton, district: Anantapur, season: rabi)

### Offline cache strategy

- STDB SDK maintains a client-side cache of subscribed rows
- On disconnect: stores stay populated with last known data
- On reconnect: SDK automatically syncs deltas
- Show "ఆఫ్‌లైన్" badge in app bar when disconnected

---

## 6. Test Plan

- [ ] Client connects to published STDB module
- [ ] farmer_balance view returns correct computed totals
- [ ] Home screen shows seeded farmer's balance
- [ ] Mandi prices display for farmer's crops
- [ ] Price bars animate on screen enter
- [ ] Real-time update: insert new money_event → balance updates live
- [ ] Disconnect WiFi → app shows cached data + offline indicator
- [ ] Reconnect → data syncs automatically

---

## 7. Session Log

| Date | Session | What Happened | Next Step |
|------|---------|---------------|-----------|
| 2026-03-16 | Spec session | Created feature contract | Build in Wave 1 |
| 2026-03-16 | Build wave 1 | spacetime generate produced 32 binding files. Rewrote db.ts (125 LOC) + stores.ts (328 LOC) for live STDB. Seeded Lakshmi demo data (1 farmer, 10 money events, 6 market prices). Home screen shows live mandi prices. Connection indicator working. svelte-check: 0 err/0 warn. | Test in browser |
