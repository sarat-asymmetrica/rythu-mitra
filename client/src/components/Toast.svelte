<script lang="ts">
  import { toasts, dismissToast } from '../lib/toast';

  const iconMap: Record<string, string> = {
    default: '🍃',
    warning: '⚠️',
    alert: '🔔',
  };

  function handleDismiss(id: number) {
    dismissToast(id);
  }

  function handleKeydown(e: KeyboardEvent, id: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismissToast(id);
    }
  }
</script>

<div class="toast-container" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <button
      class="mango-toast {toast.type}"
      class:floating={toast.floating}
      onclick={() => handleDismiss(toast.id)}
      onkeydown={(e) => handleKeydown(e, toast.id)}
      aria-label="dismiss notification"
      type="button"
    >
      <span class="toast-icon" aria-hidden="true">{iconMap[toast.type]}</span>
      <span class="toast-text">{toast.message}</span>
    </button>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: var(--space-21);
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 42px);
    max-width: 378px;
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    pointer-events: none;
  }

  .mango-toast {
    padding: var(--space-13) var(--space-21);
    background: var(--patti);
    border: 1px solid var(--nalupurugu);
    border-left: 4px solid var(--pacchi);
    border-radius: 2px 8px 8px 2px;
    box-shadow: var(--shadow-toast);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    gap: var(--space-13);
    pointer-events: auto;
    cursor: pointer;
    animation: toastIn var(--dur-610) var(--spring) forwards;
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    text-align: left;
    width: 100%;
  }

  .mango-toast.warning { border-left-color: var(--pasupu); }
  .mango-toast.alert   { border-left-color: var(--erra); }

  .mango-toast.floating {
    animation: toastFloat 2s ease-in-out infinite;
  }

  .toast-icon {
    font-size: 18px;
    flex-shrink: 0;
    line-height: 1;
  }

  .toast-text {
    font-size: var(--text-sm);
    color: var(--ink-primary);
    line-height: 1.4;
    flex: 1;
  }

  @media (max-width: 420px) {
    .toast-container { width: calc(100% - 26px); }
  }
</style>
