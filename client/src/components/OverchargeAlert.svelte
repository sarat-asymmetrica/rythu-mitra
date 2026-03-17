<script lang="ts">
  /**
   * OverchargeAlert.svelte — Vyāpti (వ్యాప్తి) alert card
   *
   * Shows when a product on the scanned bill is priced above MRP.
   * Lets the farmer call the government helpline or dismiss the alert.
   *
   * Props:
   *   overcharges  — array from detectOvercharges()
   *   onDismiss    — callback when farmer taps the dismiss button
   */
  import type { OverchargeResult } from '../lib/vyapti';
  import { formatPaise, severityLabel, KISAN_HELPLINE } from '../lib/vyapti';

  interface Props {
    overcharges: OverchargeResult[];
    onDismiss?: () => void;
  }

  let { overcharges, onDismiss }: Props = $props();

  // -------------------------------------------------------------------------
  // Severity → Matti design token colours
  // critical: dark red   alert: coral/matti  warning: amber/pasupu
  // -------------------------------------------------------------------------
  function borderColor(severity: OverchargeResult['severity']): string {
    switch (severity) {
      case 'critical': return '#9b2226';
      case 'alert':    return '#c4796b';  // Matti
      case 'warning':  return '#E8A317';  // Pasupu
    }
  }

  function bgColor(severity: OverchargeResult['severity']): string {
    switch (severity) {
      case 'critical': return 'rgba(155, 34, 38, 0.08)';
      case 'alert':    return 'rgba(196, 121, 107, 0.08)';
      case 'warning':  return 'rgba(232, 163, 23, 0.08)';
    }
  }

  function iconForSeverity(severity: OverchargeResult['severity']): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'alert':    return '⚠️';
      case 'warning':  return '🔶';
    }
  }

  // Callto: link for the helpline
  const helplineHref = `tel:${KISAN_HELPLINE}`;
</script>

{#if overcharges.length > 0}
  <div class="vyapti-container" role="alert" aria-live="polite">
    <!-- Header (shown once above all alerts) -->
    <div class="vyapti-header">
      <span class="vyapti-header-icon">⚠️</span>
      <span class="vyapti-header-text">
        ధర ఎక్కువ! ({overcharges.length} వస్తువు{overcharges.length > 1 ? 'లు' : ''})
      </span>
    </div>

    <!-- One card per overcharged product -->
    {#each overcharges as oc (oc.product.name)}
      <div
        class="vyapti-card"
        style="border-left-color: {borderColor(oc.severity)}; background: {bgColor(oc.severity)};"
      >
        <!-- Product name + severity badge -->
        <div class="vyapti-card-title">
          <span class="vyapti-severity-icon">{iconForSeverity(oc.severity)}</span>
          <strong class="vyapti-product-name">{oc.product.name}</strong>
          <span
            class="vyapti-severity-badge"
            style="color: {borderColor(oc.severity)};"
          >
            {severityLabel(oc.severity)}
          </span>
        </div>

        <!-- Unit info -->
        <div class="vyapti-unit">({oc.product.unit})</div>

        <!-- Price comparison table -->
        <div class="vyapti-price-row">
          <div class="vyapti-price-col">
            <span class="vyapti-price-label">డీలర్ ధర</span>
            <span class="vyapti-price-value vyapti-price-charged">
              {formatPaise(oc.detectedPrice)}
            </span>
          </div>
          <div class="vyapti-price-col">
            <span class="vyapti-price-label">MRP ధర</span>
            <span class="vyapti-price-value vyapti-price-mrp">
              {formatPaise(oc.expectedPrice)}
            </span>
          </div>
        </div>

        <!-- Overcharge summary -->
        <div class="vyapti-overcharge-summary" style="color: {borderColor(oc.severity)};">
          <strong>{formatPaise(oc.overchargeAmount)} ఎక్కువ</strong>
          <span class="vyapti-overcharge-pct">({oc.overchargePercent}%)</span>
        </div>
      </div>
    {/each}

    <!-- Actions (shared footer) -->
    <div class="vyapti-actions">
      <a
        href={helplineHref}
        class="vyapti-btn vyapti-btn-primary"
        aria-label="Kisan helpline call"
      >
        📞 హెల్ప్‌లైన్ {KISAN_HELPLINE}
      </a>
      <button
        type="button"
        class="vyapti-btn vyapti-btn-dismiss"
        onclick={onDismiss}
        aria-label="Dismiss overcharge alert"
      >
        ❌ పర్వాలేదు
      </button>
    </div>
  </div>
{/if}

<style>
  /* Matti earthy palette: matti=#8B4513, pasupu=#E8A317, neeli=#1B4F72 */

  .vyapti-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 12px;
    background: rgba(139, 69, 19, 0.04);
    border: 1px solid rgba(196, 121, 107, 0.3);
    font-family: 'Outfit', 'Noto Sans Telugu', sans-serif;
  }

  .vyapti-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .vyapti-header-icon {
    font-size: 1.1rem;
  }

  .vyapti-header-text {
    font-size: 1rem;
    font-weight: 700;
    color: #c4796b;
    letter-spacing: 0.01em;
  }

  /* Individual product card */
  .vyapti-card {
    border-left: 4px solid #c4796b;
    border-radius: 0 8px 8px 0;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vyapti-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .vyapti-severity-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .vyapti-product-name {
    font-size: 1rem;
    font-weight: 700;
    color: #1c1c1c;
  }

  .vyapti-severity-badge {
    font-size: 0.78rem;
    font-weight: 600;
    margin-left: auto;
  }

  .vyapti-unit {
    font-size: 0.78rem;
    color: #666;
    margin-top: -4px;
  }

  /* Price comparison */
  .vyapti-price-row {
    display: flex;
    gap: 24px;
    margin-top: 4px;
  }

  .vyapti-price-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .vyapti-price-label {
    font-size: 0.72rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .vyapti-price-value {
    font-size: 1.05rem;
    font-weight: 700;
    font-family: 'Courier Prime', monospace;
  }

  .vyapti-price-charged {
    color: #9b2226;
  }

  .vyapti-price-mrp {
    color: #1B4F72;
  }

  /* Overcharge total line */
  .vyapti-overcharge-summary {
    font-size: 0.9rem;
    margin-top: 2px;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .vyapti-overcharge-pct {
    font-size: 0.8rem;
    opacity: 0.85;
  }

  /* Action buttons */
  .vyapti-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .vyapti-btn {
    flex: 1;
    min-width: 140px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    border: none;
    transition: opacity 0.15s;
  }

  .vyapti-btn:active {
    opacity: 0.75;
  }

  .vyapti-btn-primary {
    background: #1B4F72;
    color: #fff;
  }

  .vyapti-btn-dismiss {
    background: transparent;
    color: #888;
    border: 1px solid #ddd;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .vyapti-container {
      background: rgba(139, 69, 19, 0.08);
      border-color: rgba(196, 121, 107, 0.25);
    }
    .vyapti-product-name {
      color: #f0ece6;
    }
    .vyapti-price-label {
      color: #aaa;
    }
    .vyapti-btn-dismiss {
      color: #aaa;
      border-color: #444;
    }
  }
</style>
