<script lang="ts">
  import DonutChart from '../components/DonutChart.svelte';
  import { donutSegments, totalIncome, totalExpense, balance, transactionGroups } from '../lib/stores';

  interface Props {
    ontoast?: (message: string, type: string) => void;
  }

  let { ontoast }: Props = $props();

  function showQuickToast(category: string) {
    ontoast?.(`🌿 ${category} నమోదు — మొత్తం చెప్పండి`, 'default');
  }

  function formatAmount(n: number): string {
    if (n > 0) return `+₹${n.toLocaleString('en-IN')}`;
    return `−₹${Math.abs(n).toLocaleString('en-IN')}`;
  }

  const txnIcons: Record<string, string> = {
    labor: '🧑‍🌾', seeds: '🌾', irrigation: '💧', fertilizer: '🧪',
    transport: '🚛', crop_sale: '💰', govt_subsidy: '🏛️', other: '📝',
  };
</script>

<!-- Header -->
<div class="dabbu-header">
  <div class="dabbu-header-left">
    <div class="dabbu-screen-title">దబ్బు</div>
    <div class="dabbu-screen-subtitle">మార్చి 2026 · రబీ సీజన్</div>
  </div>
  <div class="dabbu-header-right">
    <div class="balance-pill">
      <span class="balance-pill-label">మిగులు</span>
      <span class="balance-pill-amount">+₹{$balance.toLocaleString('en-IN')}</span>
    </div>
  </div>
</div>

<!-- Donut Chart Card -->
<div class="donut-card">
  <div class="donut-card-inner">
    <DonutChart />
    <div class="donut-legend">
      {#each $donutSegments as seg, i}
        <div class="legend-item" style="animation: slideInRight var(--dur-377) var(--ease-out) {i * 89}ms both;">
          <div class="legend-dot" style="background: {seg.color};"></div>
          <span class="legend-text">{seg.label}</span>
          <span class="legend-amount">₹{seg.value.toLocaleString('en-IN')}</span>
          <span class="legend-percent">{seg.percent}%</span>
        </div>
      {/each}
      <div class="legend-totals">
        <div class="legend-total-row">
          <span class="legend-total-label">ఆదాయం</span>
          <span class="legend-total-value income">+₹{$totalIncome.toLocaleString('en-IN')}</span>
        </div>
        <div class="legend-total-row">
          <span class="legend-total-label">ఖర్చు</span>
          <span class="legend-total-value expense">−₹{$totalExpense.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Quick Entry -->
<div class="quick-entry-section">
  <div class="quick-entry-label">త్వరిత నమోదు</div>
  <div class="quick-entry-row">
    <button class="quick-btn" onclick={() => showQuickToast('కూలి')}>
      <span class="quick-btn-icon">🧑‍🌾</span>
      <span class="quick-btn-label">కూలి</span>
    </button>
    <button class="quick-btn" onclick={() => showQuickToast('విత్తనం')}>
      <span class="quick-btn-icon">🌾</span>
      <span class="quick-btn-label">విత్తనం</span>
    </button>
    <button class="quick-btn" onclick={() => showQuickToast('నీరు')}>
      <span class="quick-btn-icon">💧</span>
      <span class="quick-btn-label">నీరు</span>
    </button>
    <button class="quick-btn" onclick={() => showQuickToast('ఇతర')}>
      <span class="quick-btn-icon">➕</span>
      <span class="quick-btn-label">ఇతర</span>
    </button>
  </div>
</div>

<!-- Transaction Timeline -->
<div class="txn-section-header">
  <span class="txn-section-title">లావాదేవీలు</span>
  <span class="txn-section-action">ఫిల్టర్ →</span>
</div>

<div class="txn-timeline">
  {#each $transactionGroups as group}
    <div class="date-group">
      <div class="date-label">{group.dateLabel}</div>
      {#each group.items as txn, i}
        <div class="txn-item" style="animation: slideInLeft var(--dur-377) var(--ease-out) {i * 89}ms both;">
          <div class="txn-icon {txn.kind}">{txnIcons[txn.kind] || '📝'}</div>
          <div class="txn-details">
            <div class="txn-desc">{txn.description}</div>
            <div><span class="txn-category-tag {txn.kind}">{txn.category}</span></div>
          </div>
          <div class="txn-right">
            <div class="txn-amount" class:income={txn.amount > 0} class:expense={txn.amount < 0}>
              {formatAmount(txn.amount)}
            </div>
            <div class="txn-time">{txn.time}</div>
          </div>
        </div>
      {/each}
    </div>
  {/each}
</div>

<!-- Season P&L Card -->
<div class="txn-section-header">
  <span class="txn-section-title">సీజన్ సారాంశం</span>
  <span class="txn-section-action">వివరాలు →</span>
</div>

<div class="pnl-card">
  <div class="pnl-card-label">ఈ రబీ సీజన్</div>
  <div class="pnl-net-section">
    <div class="pnl-net-sublabel">మొత్తం నికర లాభం</div>
    <div class="pnl-net-amount">లాభం ₹10,750</div>
  </div>
  <div class="pnl-bar-section">
    <div class="pnl-bar-sublabel">ఆదాయం</div>
    <div class="pnl-track income-track">
      <div class="pnl-bar income-bar" style="width: 100%; transition: width var(--dur-987) var(--spring);">
        <span class="pnl-bar-label">₹28,400</span>
      </div>
    </div>
  </div>
  <div class="pnl-bar-section">
    <div class="pnl-bar-sublabel">ఖర్చులు</div>
    <div class="pnl-track expense-track">
      <div class="pnl-bar expense-bar" style="width: 62%; transition: width var(--dur-987) var(--spring);">
        <span class="pnl-bar-label">₹17,650</span>
      </div>
    </div>
  </div>
  <div class="pnl-bar-footer">
    <span class="pnl-bar-meta">సీజన్ ప్రారంభం: <span>నవంబర్ 2025</span></span>
    <span class="pnl-bar-meta">కోత: <span>ఏప్రిల్ 2026</span></span>
  </div>
</div>

<div class="bottom-spacer"></div>

<style>
  .dabbu-header { padding: var(--space-13) var(--space-21); display: flex; align-items: center; justify-content: space-between; }
  .dabbu-header-left { animation: fadeUp var(--dur-610) var(--spring) 200ms both; }
  .dabbu-screen-title { font-family: var(--font-te-display); font-size: var(--text-xl); font-weight: 700; color: var(--ink-primary); }
  .dabbu-screen-subtitle { font-size: var(--text-xs); color: var(--ink-tertiary); margin-top: var(--space-3); font-family: var(--font-mono); letter-spacing: 0.5px; }
  .dabbu-header-right { display: flex; align-items: center; gap: var(--space-8); animation: fadeUp var(--dur-610) var(--spring) 350ms both; }
  .balance-pill { display: flex; flex-direction: column; align-items: flex-end; }
  .balance-pill-label { font-size: 10px; color: var(--ink-faint); letter-spacing: 0.5px; text-transform: uppercase; }
  .balance-pill-amount { font-size: var(--text-sm); font-weight: 700; color: var(--pacchi); font-variant-numeric: tabular-nums; }

  .donut-card {
    margin: 0 var(--space-21) var(--space-21);
    padding: var(--space-21);
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-radius: 3px 13px 5px 8px;
    position: relative;
    overflow: hidden;
    animation: fadeUp var(--dur-610) var(--ease-out) 500ms both;
  }
  .donut-card::before { content: ''; position: absolute; top: -1px; left: var(--space-21); width: 40px; height: 3px; background: var(--ittadi); border-radius: 0 0 2px 2px; animation: shimmer 3s ease-in-out infinite; }
  .donut-card-inner { display: flex; align-items: center; gap: var(--space-21); }

  .donut-legend { flex: 1; display: flex; flex-direction: column; gap: var(--space-8); }
  .legend-item { display: flex; align-items: center; gap: var(--space-8); }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-text { flex: 1; font-size: 11px; color: var(--ink-secondary); }
  .legend-amount { font-size: 11px; font-weight: 600; color: var(--ink-primary); font-variant-numeric: tabular-nums; }
  .legend-percent { font-size: 10px; color: var(--ink-faint); font-family: var(--font-mono); min-width: 28px; text-align: right; }
  .legend-totals { margin-top: var(--space-8); padding-top: var(--space-13); border-top: 1px solid var(--nalupurugu); display: flex; flex-direction: column; gap: var(--space-5); }
  .legend-total-row { display: flex; align-items: center; gap: var(--space-8); font-size: 11px; }
  .legend-total-label { flex: 1; color: var(--ink-tertiary); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .legend-total-value { font-size: var(--text-sm); font-weight: 700; font-variant-numeric: tabular-nums; }
  .legend-total-value.income { color: var(--pacchi); }
  .legend-total-value.expense { color: var(--erra); }

  .quick-entry-section { padding: 0 var(--space-21) var(--space-21); animation: fadeUp var(--dur-610) var(--ease-out) 700ms both; }
  .quick-entry-label { font-size: var(--text-xs); color: var(--ink-tertiary); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: var(--space-13); }
  .quick-entry-row { display: flex; gap: var(--space-8); }
  .quick-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--space-5); padding: var(--space-13) var(--space-5); background: var(--patti); border: 1px solid var(--nalupurugu); cursor: pointer; transition: transform var(--dur-233) var(--spring), box-shadow var(--dur-233) ease; position: relative; overflow: hidden; }
  .quick-btn:nth-child(1) { border-radius: 3px 13px 5px 8px; }
  .quick-btn:nth-child(2) { border-radius: 8px 3px 13px 5px; }
  .quick-btn:nth-child(3) { border-radius: 13px 5px 3px 8px; }
  .quick-btn:nth-child(4) { border-radius: 5px 8px 13px 3px; }
  .quick-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 21px rgba(0,0,0,0.08); background: var(--patti-warm); }
  .quick-btn:active { transform: translateY(0) scale(0.95); transition-duration: var(--dur-89); }
  .quick-btn-icon { font-size: 20px; line-height: 1; }
  .quick-btn-label { font-family: var(--font-te); font-size: 11px; font-weight: 500; color: var(--ink-secondary); white-space: nowrap; }

  .txn-section-header { padding: var(--space-21) var(--space-21) var(--space-8); display: flex; justify-content: space-between; align-items: baseline; }
  .txn-section-title { font-family: var(--font-te-display); font-size: var(--text-lg); font-weight: 400; color: var(--ink-primary); }
  .txn-section-action { font-size: var(--text-xs); color: var(--neeli); cursor: pointer; letter-spacing: 0.5px; }
  .txn-timeline { padding: 0 var(--space-21); }
  .date-group { margin-bottom: var(--space-8); }
  .date-label { font-size: var(--text-xs); color: var(--ink-faint); font-family: var(--font-mono); letter-spacing: 1px; text-transform: uppercase; padding: var(--space-5) 0; border-bottom: 1px solid rgba(212, 197, 169, 0.3); margin-bottom: var(--space-5); }

  .txn-item { display: flex; align-items: center; gap: var(--space-13); padding: var(--space-13) var(--space-8); border-radius: 4px; cursor: pointer; position: relative; overflow: hidden; transition: background var(--dur-233) ease; }
  .txn-item:hover { background: rgba(212, 197, 169, 0.15); }
  .txn-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .txn-icon.labor { background: rgba(139, 69, 19, 0.1); }
  .txn-icon.seeds { background: rgba(45, 106, 79, 0.1); }
  .txn-icon.irrigation { background: rgba(41, 128, 185, 0.1); }
  .txn-icon.fertilizer { background: rgba(27, 79, 114, 0.1); }
  .txn-icon.transport { background: var(--pasupu-glow); }
  .txn-icon.crop_sale { background: rgba(45, 106, 79, 0.1); }
  .txn-icon.govt_subsidy { background: rgba(27, 79, 114, 0.1); }
  .txn-details { flex: 1; min-width: 0; }
  .txn-desc { font-size: var(--text-sm); font-weight: 500; color: var(--ink-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txn-category-tag { display: inline-flex; margin-top: 3px; padding: 1px var(--space-5); border-radius: 2px; font-size: 10px; font-weight: 500; }
  .txn-category-tag.labor { background: rgba(139, 69, 19, 0.08); color: var(--matti); }
  .txn-category-tag.seeds { background: rgba(45, 106, 79, 0.08); color: var(--pacchi); }
  .txn-category-tag.irrigation { background: rgba(41, 128, 185, 0.08); color: var(--neeli-light); }
  .txn-category-tag.fertilizer { background: rgba(27, 79, 114, 0.08); color: var(--neeli); }
  .txn-category-tag.transport { background: rgba(232, 163, 23, 0.10); color: var(--ittadi); }
  .txn-category-tag.crop_sale { background: rgba(45, 106, 79, 0.08); color: var(--pacchi); }
  .txn-category-tag.govt_subsidy { background: rgba(27, 79, 114, 0.08); color: var(--neeli); }
  .txn-right { text-align: right; flex-shrink: 0; }
  .txn-amount { font-size: var(--text-base); font-weight: 600; font-variant-numeric: tabular-nums; }
  .txn-amount.income { color: var(--pacchi); }
  .txn-amount.expense { color: var(--erra); }
  .txn-time { font-size: 10px; color: var(--ink-faint); font-family: var(--font-mono); margin-top: 2px; }

  .pnl-card { margin: var(--space-21); padding: var(--space-21); background: var(--patti-warm); border: 1px solid var(--nalupurugu); border-radius: 5px 2px 8px 3px; position: relative; overflow: hidden; animation: fadeUp var(--dur-610) var(--ease-out) both; }
  .pnl-card::before { content: ''; position: absolute; top: -1px; left: var(--space-21); width: 30px; height: 3px; background: var(--pacchi); border-radius: 0 0 2px 2px; }
  .pnl-card-label { font-size: var(--text-xs); color: var(--ink-tertiary); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: var(--space-13); }
  .pnl-net-section { margin-bottom: var(--space-21); }
  .pnl-net-sublabel { font-size: var(--text-xs); color: var(--ink-tertiary); margin-bottom: var(--space-5); }
  .pnl-net-amount { font-family: var(--font-te-display); font-size: var(--text-2xl); font-weight: 700; color: var(--ittadi); font-variant-numeric: tabular-nums; }
  .pnl-bar-section { margin-bottom: var(--space-8); }
  .pnl-bar-sublabel { font-size: 11px; color: var(--ink-tertiary); margin-bottom: var(--space-5); }
  .pnl-track { height: 34px; border-radius: 2px 5px 2px 5px; position: relative; overflow: hidden; margin-bottom: var(--space-13); }
  .pnl-track.income-track { background: rgba(45, 106, 79, 0.08); }
  .pnl-track.expense-track { background: var(--erra-soft); }
  .pnl-bar { position: absolute; left: 0; top: 0; height: 100%; border-radius: 2px 5px 2px 5px; display: flex; align-items: center; padding-left: var(--space-13); }
  .pnl-bar.income-bar { background: linear-gradient(90deg, var(--pacchi-light), var(--pacchi)); }
  .pnl-bar.expense-bar { background: linear-gradient(90deg, #e05b4b, var(--erra)); }
  .pnl-bar-label { font-size: 11px; font-weight: 600; color: var(--patti); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pnl-bar-footer { display: flex; justify-content: space-between; }
  .pnl-bar-meta { font-size: var(--text-xs); color: var(--ink-tertiary); }
  .pnl-bar-meta span { font-weight: 600; color: var(--ink-secondary); }
</style>
