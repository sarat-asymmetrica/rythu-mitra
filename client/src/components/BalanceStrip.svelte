<script lang="ts">
  import { balance, totalIncome, totalExpense } from '../lib/stores';

  function formatRupees(n: number): string {
    return n.toLocaleString('en-IN');
  }
</script>

<div class="balance-hero">
  <div class="balance-label">ఈ నెల మిగులు</div>
  <div class="balance-amount">
    <span class="currency">₹</span>{formatRupees($balance)}
  </div>
  <div class="balance-breakdown">
    <div class="balance-item">
      <span class="balance-item-label">ఆదాయం</span>
      <span class="balance-item-value income">+₹{formatRupees($totalIncome)}</span>
    </div>
    <div class="balance-item">
      <span class="balance-item-label">ఖర్చులు</span>
      <span class="balance-item-value expense">−₹{formatRupees($totalExpense)}</span>
    </div>
  </div>
</div>

<style>
  .balance-hero {
    margin: var(--space-8) var(--space-21) var(--space-21);
    padding: var(--space-21);
    background: linear-gradient(135deg, var(--patti-warm) 0%, var(--patti) 100%);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card);
    position: relative;
    animation: fadeUp var(--dur-610) var(--ease-out) 800ms both;
  }

  .balance-hero::before {
    content: '';
    position: absolute;
    top: -1px; left: var(--space-21);
    width: 40px; height: 3px;
    background: var(--ittadi);
    border-radius: 0 0 2px 2px;
    animation: shimmer 3s ease-in-out infinite;
  }

  .balance-label {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: var(--space-8);
  }

  .balance-amount {
    font-family: var(--font-te-display);
    font-size: var(--text-hero);
    font-weight: 700;
    color: var(--pacchi);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .currency {
    font-size: var(--text-lg);
    font-weight: 400;
    color: var(--ink-tertiary);
    margin-right: var(--space-3);
  }

  .balance-breakdown {
    display: flex;
    gap: var(--space-21);
    margin-top: var(--space-13);
    padding-top: var(--space-13);
    border-top: 1px solid var(--nalupurugu);
    flex-wrap: wrap;
  }

  .balance-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .balance-item-label {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
  }

  .balance-item-value {
    font-size: var(--text-base);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .balance-item-value.income  { color: var(--pacchi); }
  .balance-item-value.expense { color: var(--erra); }
</style>
