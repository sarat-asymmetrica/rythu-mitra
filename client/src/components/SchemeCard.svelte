<script lang="ts">
  import type { GovtScheme } from '../lib/types';

  interface Props {
    scheme: GovtScheme;
  }

  let { scheme }: Props = $props();

  /** Format rupees in Telugu-friendly notation. */
  function formatAmount(paise: number): string {
    const rupees = paise;
    if (rupees >= 100000) {
      return `₹${(rupees / 100000).toFixed(1)} లక్షలు`;
    }
    if (rupees >= 1000) {
      return `₹${rupees.toLocaleString('en-IN')}`;
    }
    return `₹${rupees}`;
  }

  /** URL for the scheme's official site. */
  function schemeUrl(name: string): string {
    const urls: Record<string, string> = {
      'PM-KISAN': 'https://pmkisan.gov.in',
      'YSR Rythu Bharosa': 'https://apagrisnet.gov.in',
      'PMFBY': 'https://pmfby.gov.in',
    };
    return urls[name] ?? 'https://vikaspedia.in/social-welfare/farmers-welfare';
  }

  /** Telugu label for the status. */
  function statusLabel(status: GovtScheme['status']): string {
    switch (status) {
      case 'received': return 'అందింది';
      case 'pending': return 'పెండింగ్';
      case 'overdue': return 'ఆలస్యం';
    }
  }

  /** Status icon */
  function statusIcon(status: GovtScheme['status']): string {
    switch (status) {
      case 'received': return '✅';
      case 'pending': return '⏳';
      case 'overdue': return '⚠️';
    }
  }

  const statusClass = $derived(() => {
    switch (scheme.status) {
      case 'received': return 'received';
      case 'pending': return 'pending';
      case 'overdue': return 'overdue';
    }
  });
</script>

<div class="scheme-card {scheme.status}">
  <div class="scheme-top">
    <div class="scheme-icon-wrap">
      <span class="scheme-icon">🏛️</span>
    </div>
    <div class="scheme-name-wrap">
      <div class="scheme-name">{scheme.name}</div>
      <div class="scheme-status-row">
        <span class="scheme-status-badge {scheme.status}">
          {statusIcon(scheme.status)} {statusLabel(scheme.status)}
        </span>
      </div>
    </div>
  </div>

  <div class="scheme-details">
    {#if scheme.status === 'received'}
      <div class="scheme-detail-row">
        <span class="scheme-detail-label">చివరి వాయిదా</span>
        <span class="scheme-detail-value received">{formatAmount(scheme.lastAmount)} ({scheme.lastInstallment})</span>
      </div>
    {/if}
    {#if scheme.nextExpected}
      <div class="scheme-detail-row">
        <span class="scheme-detail-label">తదుపరి వాయిదా</span>
        <span class="scheme-detail-value {scheme.status === 'overdue' ? 'overdue' : 'neutral'}">
          ~{scheme.nextExpected}
        </span>
      </div>
    {/if}
  </div>

  <a
    href={schemeUrl(scheme.name)}
    target="_blank"
    rel="noopener noreferrer"
    class="scheme-link"
    aria-label="{scheme.name} అధికారిక వెబ్‌సైట్"
  >
    {schemeUrl(scheme.name).replace('https://', '')} లో చెక్ చేయండి →
  </a>
</div>

<style>
  .scheme-card {
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-radius: 3px 10px 5px 3px;
    overflow: hidden;
    animation: fadeUp var(--dur-377) var(--ease-out) both;
  }

  /* Left accent border by status */
  .scheme-card.received { border-left: 4px solid var(--pacchi); }
  .scheme-card.pending  { border-left: 4px solid var(--pasupu); }
  .scheme-card.overdue  { border-left: 4px solid var(--erra); }

  .scheme-top {
    display: flex;
    align-items: center;
    gap: var(--space-13);
    padding: var(--space-13) var(--space-21) var(--space-8);
  }

  .scheme-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--patti);
    border: 1px solid var(--nalupurugu);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 18px;
  }

  .scheme-name-wrap {
    flex: 1;
    min-width: 0;
  }

  .scheme-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scheme-status-row {
    margin-top: 3px;
  }

  .scheme-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px var(--space-8);
    border-radius: 20px;
    letter-spacing: 0.3px;
  }
  .scheme-status-badge.received { background: rgba(45, 106, 79, 0.1); color: var(--pacchi); }
  .scheme-status-badge.pending  { background: rgba(232, 163, 23, 0.12); color: var(--ittadi); }
  .scheme-status-badge.overdue  { background: var(--erra-soft); color: var(--erra); }

  .scheme-details {
    padding: 0 var(--space-21) var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .scheme-detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-8);
  }

  .scheme-detail-label {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    flex-shrink: 0;
  }

  .scheme-detail-value {
    font-size: var(--text-xs);
    font-weight: 600;
    text-align: right;
  }
  .scheme-detail-value.received { color: var(--pacchi); }
  .scheme-detail-value.overdue  { color: var(--erra); }
  .scheme-detail-value.neutral  { color: var(--ink-secondary); }

  .scheme-link {
    display: block;
    padding: var(--space-8) var(--space-21);
    background: var(--patti);
    border-top: 1px solid var(--nalupurugu);
    font-size: var(--text-xs);
    color: var(--neeli);
    text-decoration: none;
    transition: background var(--dur-144) ease, color var(--dur-144) ease;
    font-family: var(--font-mono);
    letter-spacing: 0.3px;
  }

  .scheme-link:hover {
    background: var(--patti-warm);
    color: var(--neeli-light, #2980B9);
  }

  .scheme-link:active {
    opacity: 0.7;
  }
</style>
