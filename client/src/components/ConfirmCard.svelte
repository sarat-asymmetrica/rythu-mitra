<script lang="ts">
  import type { ChatAction } from '../lib/chat';

  interface Props {
    action: ChatAction;
    onconfirm: (action: ChatAction) => void;
    onedit: (action: ChatAction) => void;
    ondismiss: () => void;
  }

  let { action, onconfirm, onedit, ondismiss }: Props = $props();

  let editingAmount = $state(false);
  let editAmount = $state(0);

  const kindIcons: Record<string, string> = {
    CropSale: '💰', InputPurchase: '🧪', LaborPayment: '🧑‍🌾',
    GovernmentTransfer: '🏛️', UPIPayment: '📱', Other: '📝',
    Planted: '🌱', Sprayed: '💊', PestObserved: '🐛',
    Irrigated: '💧', Harvested: '🌾', Sold: '💰',
  };

  const kindLabels: Record<string, string> = {
    CropSale: 'పంట అమ్మకం', InputPurchase: 'కొనుగోలు', LaborPayment: 'కూలి',
    GovernmentTransfer: 'సర్కారు బదిలీ', UPIPayment: 'UPI', Other: 'ఇతర',
    Planted: 'విత్తు', Sprayed: 'పిచికారీ', PestObserved: 'పురుగు',
    Irrigated: 'నీటిపారుదల', Harvested: 'కోత', Sold: 'అమ్మకం',
  };

  function getIcon(): string {
    if (isDeleteAction()) return '🗑️';
    if (isUpdateAction()) return '✏️';
    const kind = (action.kind as string) || '';
    return kindIcons[kind] || '📝';
  }

  function getLabel(): string {
    const kind = (action.kind as string) || '';
    return kindLabels[kind] || 'ఇతర';
  }

  function formatAmount(paise?: unknown): string {
    const p = Number(paise || action.amount_paise || 0);
    const rupees = Math.round(p / 100);
    return rupees.toLocaleString('en-IN');
  }

  function isMoneyAction(): boolean {
    return action.action === 'record_money' || action.action === 'record_from_bill';
  }

  function isCropAction(): boolean {
    return action.action === 'record_crop';
  }

  function isUpdateAction(): boolean {
    return action.action === 'update_money';
  }

  function isDeleteAction(): boolean {
    return action.action === 'delete_money';
  }

  /** Determine the card variant for styling. */
  function getVariant(): 'create' | 'update' | 'delete' | 'income' {
    if (isDeleteAction()) return 'delete';
    if (isUpdateAction()) return 'update';
    if (action.is_income as boolean) return 'income';
    return 'create';
  }

  function handleEditAmount(e: Event) {
    const input = e.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val > 0) {
      editAmount = val;
    }
  }

  function startEdit() {
    editAmount = Math.round(Number(action.amount_paise || 0) / 100);
    editingAmount = true;
  }

  function confirmEdit() {
    editingAmount = false;
    const updated = { ...action, amount_paise: editAmount * 100 };
    onedit(updated);
  }

  function handleConfirm() {
    onconfirm(action);
  }

  let variant = $derived(getVariant());
</script>

<div
  class="confirm-card"
  class:income={variant === 'income'}
  class:update={variant === 'update'}
  class:delete={variant === 'delete'}
>
  <div class="card-row">
    <span class="card-icon">{getIcon()}</span>
    <div class="card-info">
      {#if isDeleteAction()}
        <!-- DELETE card -->
        <div class="card-action-badge delete-badge">తొలగింపు</div>
        <div class="card-amount delete-amount">
          ₹{formatAmount()}
        </div>
        {#if action.description}
          <div class="card-desc">"{action.description}"</div>
        {/if}
      {:else if isUpdateAction()}
        <!-- UPDATE card -->
        <div class="card-action-badge update-badge">మార్పు</div>
        <div class="card-diff">
          <span class="old-value">₹{formatAmount(action.old_value)}</span>
          <span class="diff-arrow">→</span>
          <span class="new-value">₹{formatAmount(action.amount_paise)}</span>
        </div>
        <div class="card-label">{getLabel()}</div>
        {#if action.description}
          <div class="card-desc">"{action.description}"</div>
        {/if}
      {:else if isMoneyAction()}
        <!-- CREATE / RECORD money -->
        {#if editingAmount}
          <div class="edit-row">
            <span class="rupee-sign">₹</span>
            <input
              type="number"
              class="amount-edit-input"
              value={editAmount}
              oninput={handleEditAmount}
              min="1"
            />
            <button class="mini-btn done" onclick={confirmEdit}>✓</button>
          </div>
        {:else}
          <div class="card-amount" class:income={action.is_income as boolean}>
            {action.is_income ? '+' : ''}₹{formatAmount()}
          </div>
        {/if}
        <div class="card-label">{getLabel()}</div>
        {#if action.description}
          <div class="card-desc">"{action.description}"</div>
        {/if}
      {:else if isCropAction()}
        <!-- CROP event -->
        <div class="card-label">{getLabel()} -- {action.crop}</div>
        {#if action.description}
          <div class="card-desc">"{action.description}"</div>
        {/if}
      {/if}
    </div>
  </div>

  <div class="card-actions">
    {#if isDeleteAction()}
      <button class="action-btn confirm-delete" onclick={handleConfirm}>
        🗑️ తొలగించు
      </button>
    {:else if isUpdateAction()}
      <button class="action-btn confirm-update" onclick={handleConfirm}>
        ✓ మార్చు
      </button>
    {:else}
      <button class="action-btn confirm" onclick={handleConfirm}>
        ✓ సరే
      </button>
    {/if}
    {#if isMoneyAction() && !editingAmount}
      <button class="action-btn edit" onclick={startEdit}>
        ✏️ మార్చు
      </button>
    {/if}
    <button class="action-btn dismiss" onclick={ondismiss}>
      ✕
    </button>
  </div>
</div>

<style>
  .confirm-card {
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-radius: 3px 13px 5px 8px;
    padding: var(--space-13);
    margin-top: var(--space-8);
    animation: cardSlideIn var(--dur-377) var(--spring) both;
  }

  /* Variant borders */
  .confirm-card.income {
    border-left: 3px solid var(--pacchi);
  }

  .confirm-card:not(.income):not(.update):not(.delete) {
    border-left: 3px solid var(--erra);
  }

  .confirm-card.update {
    border-left: 3px solid var(--neeli, #2980B9);
    background: color-mix(in srgb, var(--patti-warm) 92%, var(--neeli, #2980B9) 8%);
  }

  .confirm-card.delete {
    border-left: 3px solid var(--erra);
    background: color-mix(in srgb, var(--patti-warm) 90%, var(--erra) 10%);
  }

  .card-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-8);
    margin-bottom: var(--space-8);
  }

  .card-icon {
    font-size: 24px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .card-info {
    flex: 1;
    min-width: 0;
  }

  /* Action badges (NEW) */
  .card-action-badge {
    display: inline-block;
    font-size: var(--text-xs);
    font-weight: 700;
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    margin-bottom: var(--space-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .update-badge {
    background: var(--neeli, #2980B9);
    color: white;
  }

  .delete-badge {
    background: var(--erra);
    color: white;
  }

  .card-amount {
    font-family: var(--font-te-display);
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .card-amount.income { color: var(--pacchi); }
  .card-amount:not(.income) { color: var(--erra); }

  .delete-amount {
    font-family: var(--font-te-display);
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--erra);
    text-decoration: line-through;
    opacity: 0.7;
  }

  /* Update diff display (NEW) */
  .card-diff {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .old-value {
    color: var(--ink-tertiary);
    text-decoration: line-through;
  }

  .diff-arrow {
    color: var(--neeli, #2980B9);
    font-size: var(--text-sm);
  }

  .new-value {
    color: var(--neeli, #2980B9);
  }

  .card-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-primary);
    margin-top: var(--space-2);
  }

  .card-desc {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    font-style: italic;
    margin-top: var(--space-3);
  }

  .edit-row {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .rupee-sign {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--ink-secondary);
  }

  .amount-edit-input {
    width: 100px;
    font-family: var(--font-te-display);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--ink-primary);
    border: none;
    border-bottom: 2px solid var(--pasupu);
    background: transparent;
    padding: var(--space-2);
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  .mini-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    cursor: pointer;
  }

  .mini-btn.done {
    background: var(--pacchi);
    color: white;
  }

  .card-actions {
    display: flex;
    gap: var(--space-5);
  }

  .action-btn {
    flex: 1;
    padding: var(--space-8);
    border-radius: var(--radius-card-xs);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    font-weight: 600;
    min-height: 40px;
    cursor: pointer;
    transition: transform var(--dur-233) var(--spring);
  }

  .action-btn:active { transform: scale(0.95); }

  .action-btn.confirm {
    background: var(--pacchi);
    color: white;
    box-shadow: 0 2px 8px rgba(45, 106, 79, 0.3);
  }

  .action-btn.confirm-update {
    background: var(--neeli, #2980B9);
    color: white;
    box-shadow: 0 2px 8px rgba(41, 128, 185, 0.3);
  }

  .action-btn.confirm-delete {
    background: var(--erra);
    color: white;
    box-shadow: 0 2px 8px rgba(192, 57, 43, 0.3);
  }

  .action-btn.edit {
    background: var(--patti);
    color: var(--neeli);
    border: 1px solid var(--nalupurugu);
  }

  .action-btn.dismiss {
    flex: 0 0 40px;
    background: var(--patti);
    color: var(--ink-tertiary);
    border: 1px solid var(--nalupurugu);
  }
</style>
