<script lang="ts">
  import type { ScreenName } from '../lib/types';

  interface Props {
    activeScreen?: ScreenName;
    onstart?: () => void;
    onstop?: () => void;
    onopenvoicesheet?: () => void;
  }

  let { activeScreen = 'home', onstart, onstop, onopenvoicesheet }: Props = $props();

  function handleTap() {
    // Open VoiceSheet for expense entry from any screen
    onopenvoicesheet?.();
  }
</script>

<button
  class="voice-fab"
  onclick={handleTap}
  aria-label="మాట్లాడండి"
>
  <!-- Breathing ring -->
  <span class="fab-ring" aria-hidden="true"></span>
  <!-- Mic icon -->
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
  </svg>
</button>

<style>
  .voice-fab {
    position: fixed;
    bottom: 89px;
    right: var(--space-21);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--pasupu);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-fab);
    z-index: var(--z-fab);
    -webkit-tap-highlight-color: transparent;
    transition:
      transform var(--dur-233) var(--spring),
      box-shadow var(--dur-233) ease,
      background var(--dur-233) ease;
    animation: fabEntry var(--dur-610) var(--spring) 1800ms both;
  }

  .voice-fab:hover {
    transform: scale(1.08);
    box-shadow: var(--shadow-fab-hover);
  }

  .voice-fab:active {
    transform: scale(0.92);
    transition-duration: var(--dur-89);
  }

  .voice-fab :global(svg) {
    width: 24px;
    height: 24px;
    fill: var(--patti);
    transition: transform var(--dur-233) ease;
  }

  /* Breathing ring */
  .fab-ring {
    position: absolute;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid var(--pasupu);
    opacity: 0;
    animation: breatheRing var(--breathe) ease-in-out infinite;
    pointer-events: none;
  }

</style>
