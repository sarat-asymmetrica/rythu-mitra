<script lang="ts">
  import BriefingCard from '../components/BriefingCard.svelte';
  import BalanceStrip from '../components/BalanceStrip.svelte';
  import { moneyEvents, myFarmer, myFarmerContext, briefingCards, connected } from '../lib/stores';
  import { online } from '../lib/network';
  import type { BriefingCard as BriefingCardType } from '../lib/types';

  // Static briefing cards (shown alongside or when no STDB data)
  const staticCards: (BriefingCardType & { delay: number })[] = [
    {
      id: 'govt-pmkisan',
      accent: 'govt' as const,
      icon: '🏛️',
      title: 'PM-KISAN: తదుపరి వాయిదా',
      body: 'చివరి వాయిదా: 14 జూన్ 2025 · ₹2,000<br>తదుపరి వాయిదా ఇంకా జమ కాలేదు. మార్చి చివరి వారంలో అంచనా.',
      meta: 'చివరిసారి తనిఖీ: నిన్న 18:30',
      delay: 400,
    },
    {
      id: 'crop-health',
      accent: 'crop' as const,
      icon: '🌱',
      title: 'పంట: వేరుశెనగ — మంచి స్థితి',
      body: 'చివరి నమోదు: 3 రోజుల క్రితం పురుగు గుర్తింపు<br>బోల్ వార్మ్ — 35% ప్రభావం<br>చికిత్స: వేప నూనె పిచికారీ ✓ పూర్తయింది',
      meta: 'తదుపరి: 2 రోజుల్లో పరిశీలన',
      delay: 600,
    },
  ];

  // Icon map for transaction types
  const txnIcons: Record<string, string> = {
    labor: '🧑‍🌾', seeds: '🌾', irrigation: '💧', fertilizer: '🧪',
    transport: '🚛', crop_sale: '💰', govt_subsidy: '🏛️', other: '📝',
  };

  const txnIconClass: Record<string, string> = {
    labor: 'expense', seeds: 'expense', irrigation: 'expense', fertilizer: 'expense',
    transport: 'expense', crop_sale: 'income', govt_subsidy: 'govt', other: 'expense',
  };

  function formatAmount(n: number): string {
    if (n > 0) return `+₹${n.toLocaleString('en-IN')}`;
    return `−₹${Math.abs(n).toLocaleString('en-IN')}`;
  }

  function amountClass(n: number): string {
    if (n > 0) return 'income';
    return 'expense';
  }

  function seasonLabel(stage: string | undefined): string {
    const map: Record<string, string> = {
      pre_sowing: 'విత్తు ముందు',
      sowing: 'విత్తు సీజన్',
      growing: 'పెరుగుదల సీజన్',
      harvest: 'కోత సీజన్',
      post_harvest: 'కోత తర్వాత',
    };
    return map[stage ?? ''] ?? 'రబీ సీజన్';
  }

  function seasonProgress(stage: string | undefined): number {
    const map: Record<string, number> = {
      pre_sowing: 10,
      sowing: 25,
      growing: 60,
      harvest: 85,
      post_harvest: 95,
    };
    return map[stage ?? ''] ?? 70;
  }

  function parseCrops(cropsJson: string | undefined): string {
    if (!cropsJson) return 'వేరుశెనగ';
    try {
      const arr = JSON.parse(cropsJson);
      return Array.isArray(arr) && arr.length > 0 ? arr.join(' · ') : 'వేరుశెనగ';
    } catch {
      return 'వేరుశెనగ';
    }
  }

  // Combine live briefing cards with static ones
  function getAllCards(live: BriefingCardType[]): (BriefingCardType & { delay: number })[] {
    const liveWithDelay = live.map((c, i) => ({ ...c, delay: 200 + i * 200 }));
    const staticWithOffset = staticCards.map((c, i) => ({
      ...c,
      delay: 200 + (live.length + i) * 200,
    }));
    return [...liveWithDelay, ...staticWithOffset];
  }
</script>

<!-- Greeting -->
<div class="app-header">
  <div class="greeting">శుభోదయం, {$myFarmer?.name ?? 'రైతు'} 🙏</div>
  <div class="greeting-sub">మీ పొలం యొక్క నేటి సారాంశం</div>
  <div class="greeting-date">{new Date().toLocaleDateString('te-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {seasonLabel($myFarmerContext?.seasonStage)}</div>
</div>

<!-- Balance Hero -->
<BalanceStrip />

<!-- Season Progress Ring -->
<div class="season-ring-wrap">
  <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--nalupurugu)" stroke-width="3"/>
    <circle cx="24" cy="24" r="20" fill="none"
            stroke="var(--pacchi)" stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray={2 * Math.PI * 20}
            stroke-dashoffset={2 * Math.PI * 20 * (1 - seasonProgress($myFarmerContext?.seasonStage) / 100)}
            transform="rotate(-90 24 24)"
            style="animation: rangoli-draw 1.5s ease-out 1400ms both"/>
    <circle cx="24" cy="24" r="3" fill="var(--pacchi-light)" opacity="0.6"/>
  </svg>
  <div class="season-ring-label">
    <div class="season-ring-title">{seasonLabel($myFarmerContext?.seasonStage)} — {seasonProgress($myFarmerContext?.seasonStage)}% పూర్తి</div>
    <div class="season-ring-sub">{parseCrops($myFarmerContext?.crops)}</div>
  </div>
</div>

<!-- Morning Briefing -->
<div class="section-header">
  <span class="section-title">నేటి సారాంశం</span>
  <span class="section-header-right">
    {#if !$online}
      <span class="offline-badge">ఆఫ్‌లైన్ డేటా</span>
    {/if}
    <span class="section-action">అన్నీ చూడండి →</span>
  </span>
</div>

<div class="briefing-scroll">
  {#each getAllCards($briefingCards) as card}
    <BriefingCard
      accent={card.accent}
      icon={card.icon}
      title={card.title}
      body={card.body}
      meta={card.meta}
      delay={card.delay}
      speakText={card.speakText ?? ''}
    />
  {/each}
</div>

<!-- Recent Transactions -->
<div class="section-header">
  <span class="section-title">ఇటీవలి లావాదేవీలు</span>
  <span class="section-action">అన్నీ →</span>
</div>

<div class="txn-list">
  {#each $moneyEvents.slice(0, 5) as txn, i}
    <div class="txn-item" style="animation-delay: {i * 89}ms">
      <div class="txn-icon {txnIconClass[txn.kind]}">{txnIcons[txn.kind] || '📝'}</div>
      <div class="txn-details">
        <div class="txn-desc">{txn.description}</div>
        <div class="txn-category">{txn.category}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amount {amountClass(txn.amount)}">{formatAmount(txn.amount)}</div>
        <div class="txn-time">{txn.time}</div>
      </div>
    </div>
  {/each}
</div>

<div class="bottom-spacer"></div>

<style>
  .app-header {
    padding: var(--space-13) var(--space-21) var(--space-21);
    position: relative;
    overflow: hidden;
  }

  .greeting {
    font-family: var(--font-te-display);
    font-size: var(--text-xl);
    font-weight: 400;
    color: var(--ink-primary);
    animation: fadeUp var(--dur-610) var(--spring) 300ms both;
  }

  .greeting-sub {
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
    margin-top: var(--space-5);
    animation: fadeUp var(--dur-610) var(--spring) 500ms both;
  }

  .greeting-date {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    margin-top: var(--space-3);
    letter-spacing: 1px;
    animation: fadeUp var(--dur-377) ease 700ms both;
  }

  .season-ring-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-13);
    padding: 0 var(--space-21) var(--space-13);
    animation: fadeUp var(--dur-610) var(--ease-out) 1200ms both;
  }

  .season-ring-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-primary);
  }

  .season-ring-sub {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    font-family: var(--font-mono);
  }

  .section-header {
    padding: var(--space-21) var(--space-21) var(--space-8);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .section-title {
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    font-weight: 400;
    color: var(--ink-primary);
  }

  .section-action {
    font-size: var(--text-xs);
    color: var(--neeli);
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: color var(--dur-233) ease;
  }

  .section-action:hover { color: var(--neeli-light); }

  .section-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .offline-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--erra);
    background: var(--erra-soft);
    padding: 2px var(--space-8);
    border-radius: 3px 8px 3px 5px;
    letter-spacing: 0.3px;
  }

  .briefing-scroll {
    padding: 0 var(--space-21);
    display: flex;
    flex-direction: column;
    gap: var(--space-13);
  }

  .txn-list { padding: 0 var(--space-21); }

  .txn-item {
    display: flex;
    align-items: center;
    gap: var(--space-13);
    padding: var(--space-13) var(--space-8);
    border-bottom: 1px solid var(--nalupurugu-soft);
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: background var(--dur-233) ease;
    animation: slideInLeft var(--dur-377) var(--ease-out) both;
  }

  .txn-item:hover { background: rgba(212, 197, 169, 0.15); }

  .txn-icon {
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .txn-icon.income  { background: var(--pacchi-glow); }
  .txn-icon.expense { background: var(--erra-soft); }
  .txn-icon.govt    { background: var(--neeli-glow); }

  .txn-details { flex: 1; min-width: 0; }

  .txn-desc {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .txn-category {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    margin-top: 2px;
  }

  .txn-right { text-align: right; flex-shrink: 0; }

  .txn-amount {
    font-size: var(--text-base);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .txn-amount.income  { color: var(--pacchi); }
  .txn-amount.expense { color: var(--erra); }

  .txn-time {
    font-size: 10px;
    color: var(--ink-faint);
    font-family: var(--font-mono);
    margin-top: 2px;
  }

  @media (max-width: 420px) {
    .section-header, .briefing-scroll, .txn-list {
      padding-left: var(--space-13);
      padding-right: var(--space-13);
    }
  }
</style>
