<script lang="ts">
  import { onMount } from 'svelte';
  import { speakIfEnabled, isTTSEnabled } from '../lib/tts';
  import { hasApiKey } from '../lib/sarvam';
  import { showToast } from '../lib/toast';

  interface Props {
    accent: 'market' | 'govt' | 'crop' | 'alert' | 'money';
    icon: string;
    title: string;
    body: string;
    meta: string;
    delay?: number;
    speakText?: string;
  }

  let { accent, icon, title, body, meta, delay = 0, speakText = '' }: Props = $props();

  let visible = $state(false);
  let speaking = $state(false);
  let cardEl: HTMLElement;

  async function handleSpeak(e: MouseEvent) {
    e.stopPropagation();
    if (!speakText) return;
    if (!hasApiKey()) {
      showToast('API కీ సెట్ చేయబడలేదు. సెట్టింగ్స్‌లో నమోదు చేయండి.', 'warning', 4000);
      return;
    }
    if (!isTTSEnabled()) {
      showToast('ధ్వని నిర్ధారణ ఆపివేయబడింది. Settings లో ఆన్ చేయండి.', 'warning', 3000);
      return;
    }
    speaking = true;
    try {
      await speakIfEnabled(speakText);
    } finally {
      speaking = false;
    }
  }

  onMount(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => { visible = true; }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    if (cardEl) observer.observe(cardEl);
    return () => observer.disconnect();
  });
</script>

<div
  bind:this={cardEl}
  class="briefing-card matti-card"
  class:animate-in={visible}
>
  <div class="card-accent {accent}"></div>
  <div class="card-header-row">
    <div class="card-icon {accent}">{icon}</div>
    {#if speakText}
      <button
        class="speak-btn"
        class:speaking
        onclick={handleSpeak}
        aria-label="read aloud"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5zM14 3.23v2.06A7.003 7.003 0 0119 12c0 3.12-2.04 5.76-4.86 6.71v2.06A9.005 9.005 0 0021 12c0-4.08-2.72-7.52-6.44-8.63L14 3.23z"/>
        </svg>
      </button>
    {/if}
  </div>
  <div class="card-title">{title}</div>
  <div class="card-body">{@html body}</div>
  <div class="card-meta">{meta}</div>
</div>

<style>
  .matti-card {
    padding: var(--space-21);
    background: var(--patti);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card);
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition:
      transform var(--dur-377) var(--spring),
      box-shadow var(--dur-377) ease;
    opacity: 0;
    transform: translateY(15px);
  }

  .matti-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lift);
  }

  .matti-card:active {
    transform: translateY(0) scale(0.98);
    transition-duration: var(--dur-89);
    box-shadow: var(--shadow-card);
  }

  .matti-card.animate-in {
    animation: cardSlideIn var(--dur-610) var(--ease-out) forwards;
  }

  .card-accent {
    position: absolute;
    top: 0; left: 0;
    width: 3px; height: 100%;
    border-radius: 3px 0 0 3px;
  }
  .card-accent.market { background: var(--pasupu); }
  .card-accent.govt   { background: var(--neeli); }
  .card-accent.crop   { background: var(--pacchi); }
  .card-accent.alert  { background: var(--erra); }
  .card-accent.money  { background: var(--ittadi); }

  .card-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-8);
  }

  .card-icon {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .speak-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    transition: color var(--dur-233) ease, background var(--dur-233) ease;
    padding: 0;
    border: none;
    -webkit-tap-highlight-color: transparent;
    margin: -12px -12px -12px 0;
  }

  .speak-btn:hover {
    color: var(--pasupu);
    background: var(--pasupu-glow);
  }

  .speak-btn:active {
    transform: scale(0.9);
  }

  .speak-btn.speaking {
    color: var(--pasupu);
    animation: breathePulse-speak 1.2s ease-in-out infinite;
  }

  @keyframes breathePulse-speak {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .card-icon.market { background: var(--pasupu-glow); }
  .card-icon.govt   { background: var(--neeli-glow); }
  .card-icon.crop   { background: var(--pacchi-glow); }
  .card-icon.alert  { background: var(--erra-soft); }
  .card-icon.money  { background: var(--ittadi-glow); }

  .card-title {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink-primary);
    margin-bottom: var(--space-5);
    line-height: 1.5;
  }

  .card-body {
    font-size: var(--text-sm);
    color: var(--ink-secondary);
    line-height: 1.7;
  }

  .card-meta {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    margin-top: var(--space-8);
    font-family: var(--font-mono);
  }
</style>
