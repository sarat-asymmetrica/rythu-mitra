<script lang="ts">
  import type { ParsedExpense } from '../lib/voice';
  import type { MoneyEventKind } from '../lib/types';

  interface Props {
    parsed: ParsedExpense;
    editing: boolean;
    onedit?: (field: string, value: string | number) => void;
  }

  let { parsed, editing, onedit }: Props = $props();

  const kindIcons: Record<string, string> = {
    labor: '🧑‍🌾', seeds: '🌾', fertilizer: '🧪', irrigation: '💧',
    crop_sale: '💰', govt_subsidy: '🏛️', transport: '🚛', other: '📝',
  };

  const kindColors: Record<string, string> = {
    labor: 'var(--matti)', seeds: 'var(--pacchi)', fertilizer: 'var(--neeli)',
    irrigation: 'var(--neeli-light)', crop_sale: 'var(--pacchi)', govt_subsidy: 'var(--neeli)',
    transport: 'var(--ittadi)', other: 'var(--ink-tertiary)',
  };

  const ALL_KINDS: { value: MoneyEventKind; label: string }[] = [
    { value: 'labor', label: 'కూలి' },
    { value: 'seeds', label: 'విత్తనాలు' },
    { value: 'fertilizer', label: 'ఎరువులు' },
    { value: 'irrigation', label: 'నీటిపారుదల' },
    { value: 'crop_sale', label: 'అమ్మకం' },
    { value: 'govt_subsidy', label: 'సర్కారు' },
    { value: 'transport', label: 'రవాణా' },
    { value: 'other', label: 'ఇతర' },
  ];

  function formatRupees(paise: number): string {
    const rupees = Math.round(paise / 100);
    return rupees.toLocaleString('en-IN');
  }

  function handleAmountInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const rupees = parseInt(target.value, 10);
    if (!isNaN(rupees) && rupees >= 0) {
      onedit?.('amount_paise', rupees * 100);
    }
  }

  function handleKindSelect(kind: MoneyEventKind) {
    onedit?.('kind', kind);
  }
</script>

<div
  class="parsed-card"
  class:income={parsed.is_income}
  class:expense={!parsed.is_income}
  role="region"
  aria-label="parsed expense details"
>
  <!-- Icon + Amount row -->
  <div class="card-top">
    <div class="kind-icon" style="background: {kindColors[parsed.kind] || 'var(--ink-tertiary)'}20;">
      <span aria-hidden="true">{kindIcons[parsed.kind] || '📝'}</span>
    </div>
    <div class="amount-section">
      {#if editing}
        <div class="edit-amount-row">
          <span class="rupee-prefix">₹</span>
          <input
            type="number"
            class="amount-input"
            value={Math.round(parsed.amount_paise / 100)}
            oninput={handleAmountInput}
            min="1"
            aria-label="amount in rupees"
          />
        </div>
      {:else}
        <div class="amount-display" class:income={parsed.is_income} class:expense={!parsed.is_income}>
          {parsed.is_income ? '+' : ''}₹{formatRupees(parsed.amount_paise)}
        </div>
      {/if}
    </div>
  </div>

  <!-- Telugu transcription -->
  <div class="transcription">
    "{parsed.text}"
  </div>

  <!-- Category pill -->
  {#if editing}
    <div class="kind-pills" role="radiogroup" aria-label="select category">
      {#each ALL_KINDS as k}
        <button
          class="kind-pill"
          class:selected={parsed.kind === k.value}
          onclick={() => handleKindSelect(k.value)}
          role="radio"
          aria-checked={parsed.kind === k.value}
          aria-label={k.label}
          style="--pill-color: {kindColors[k.value] || 'var(--ink-tertiary)'}"
        >
          <span class="pill-icon">{kindIcons[k.value] || '📝'}</span>
          <span class="pill-label">{k.label}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="kind-row">
      <span
        class="kind-tag"
        style="background: {kindColors[parsed.kind] || 'var(--ink-tertiary)'}12; color: {kindColors[parsed.kind] || 'var(--ink-tertiary)'};"
      >
        {parsed.kindLabel}
      </span>
      {#if parsed.party_name}
        <span class="party-name">{parsed.party_name}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .parsed-card {
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-radius: 3px 13px 5px 8px;
    padding: var(--space-21);
    position: relative;
    overflow: hidden;
    animation: cardSlideIn var(--dur-377) var(--spring) both;
  }

  .parsed-card::before {
    content: '';
    position: absolute;
    top: -1px;
    left: var(--space-21);
    width: 30px;
    height: 3px;
    border-radius: 0 0 2px 2px;
  }

  .parsed-card.income::before { background: var(--pacchi); }
  .parsed-card.expense::before { background: var(--erra); }

  .card-top {
    display: flex;
    align-items: center;
    gap: var(--space-13);
    margin-bottom: var(--space-13);
  }

  .kind-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  .amount-section { flex: 1; }

  .amount-display {
    font-family: var(--font-te-display);
    font-size: var(--text-2xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .amount-display.income { color: var(--pacchi); }
  .amount-display.expense { color: var(--erra); }

  .edit-amount-row {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .rupee-prefix {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--ink-secondary);
  }

  .amount-input {
    width: 120px;
    font-family: var(--font-te-display);
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--ink-primary);
    border: none;
    border-bottom: 2px solid var(--pasupu);
    background: transparent;
    padding: var(--space-3) var(--space-5);
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  .amount-input:focus {
    border-bottom-color: var(--ittadi);
  }

  .transcription {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
    font-style: italic;
    margin-bottom: var(--space-13);
    line-height: 1.5;
  }

  .kind-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .kind-tag {
    display: inline-flex;
    padding: var(--space-3) var(--space-8);
    border-radius: 2px 5px 2px 4px;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .party-name {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
  }

  /* Edit mode: kind pill selector */
  .kind-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .kind-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-8);
    border-radius: var(--radius-pill);
    border: 1px solid var(--nalupurugu);
    background: var(--patti);
    font-family: var(--font-te);
    font-size: 11px;
    color: var(--ink-secondary);
    cursor: pointer;
    transition: all var(--dur-233) var(--spring);
    min-height: 32px;
  }

  .kind-pill.selected {
    background: var(--pill-color, var(--pasupu));
    color: var(--patti);
    border-color: var(--pill-color, var(--pasupu));
  }

  .kind-pill:hover:not(.selected) {
    border-color: var(--pill-color, var(--pasupu));
    transform: translateY(-1px);
  }

  .pill-icon { font-size: 14px; line-height: 1; }
  .pill-label { white-space: nowrap; }
</style>
