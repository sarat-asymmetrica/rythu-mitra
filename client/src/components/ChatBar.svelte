<script lang="ts">
  import { activeMessages, chatState } from '../lib/chat';

  interface Props {
    onclick: () => void;
  }

  let { onclick }: Props = $props();

  // Show last message preview
  const lastPreview = $derived.by(() => {
    const msgs = $activeMessages;
    if (msgs.length === 0) return '';
    const last = msgs[msgs.length - 1];
    const text = last.content.slice(0, 45);
    return text + (last.content.length > 45 ? '...' : '');
  });

  const isActive = $derived(
    $chatState === 'thinking' || $chatState === 'responding' || $chatState === 'transcribing'
  );
</script>

<button class="chat-bar" class:active={isActive} onclick={onclick} aria-label="open chat">
  <span class="chat-bar-icon" aria-hidden="true">💬</span>
  <span class="chat-bar-text">
    {#if isActive}
      <span class="typing-indicator">
        <span></span><span></span><span></span>
      </span>
    {:else if lastPreview}
      {lastPreview}
    {:else}
      అడగండి...
    {/if}
  </span>
  <svg class="chat-bar-arrow" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
  </svg>
</button>

<style>
  .chat-bar {
    position: fixed;
    bottom: 68px; /* above BottomNav */
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 420px;
    height: 48px;
    background: var(--patti-warm);
    border-top: 1px solid var(--nalupurugu);
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-13);
    z-index: var(--z-nav);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--dur-233) ease, box-shadow var(--dur-233) ease;
  }

  .chat-bar:hover {
    background: var(--patti);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  }

  .chat-bar:active {
    background: var(--nalupurugu-soft);
  }

  .chat-bar.active {
    border-top-color: var(--pasupu);
  }

  .chat-bar-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .chat-bar-text {
    flex: 1;
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .chat-bar-arrow {
    color: var(--ink-faint);
    flex-shrink: 0;
    transition: transform var(--dur-233) ease;
  }

  .chat-bar:hover .chat-bar-arrow {
    transform: translateY(-2px);
  }

  /* Inline typing dots */
  .typing-indicator {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    height: 14px;
  }

  .typing-indicator span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--pasupu);
    animation: dotBounce 1.2s ease-in-out infinite;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes dotBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  @media (max-width: 420px) {
    .chat-bar { max-width: 100%; }
  }
</style>
