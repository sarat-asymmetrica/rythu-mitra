<script lang="ts">
  import { activeScreen } from '../lib/stores';
  import type { ScreenName } from '../lib/types';

  const navItems: { id: ScreenName; label: string; icon: string }[] = [
    { id: 'home',   label: 'హోం',      icon: 'home' },
    { id: 'dabbu',  label: 'దబ్బు',    icon: 'money' },
    { id: 'market', label: 'మార్కెట్', icon: 'market' },
    { id: 'panta',  label: 'పంట',      icon: 'crop' },
    { id: 'learn',  label: 'నేర్చు',   icon: 'learn' },
  ];

  function handleNav(screen: ScreenName) {
    activeScreen.set(screen);
  }

  function createRipple(e: MouseEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 610);
  }
</script>

<nav class="bottom-nav" aria-label="ప్రధాన నావిగేషన్">
  {#each navItems as item, i}
    <button
      class="nav-item"
      class:active={$activeScreen === item.id}
      onclick={(e) => { handleNav(item.id); createRipple(e, e.currentTarget as HTMLElement); }}
      aria-label={item.label}
    >
      {#if item.icon === 'home'}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      {:else if item.icon === 'money'}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.87c0 1.73-1.27 2.9-3.12 3.17z"/></svg>
      {:else if item.icon === 'market'}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
      {:else if item.icon === 'crop'}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.12 10c.94-.36 1.67-1.19 1.84-2.2a2.998 2.998 0 00-5.19-2.55c-.34-.05-.68-.05-1.02-.05C8.96 5.2 5.8 7.5 5.01 10.6c0 0-.31 1.24.41 2.92.72 1.68 3.26 4.48 6.58 4.48s5.86-2.8 6.58-4.48c.72-1.68.41-2.92.41-2.92-.38-1.2-1.1-2.07-1.87-2.6z"/></svg>
      {:else if item.icon === 'learn'}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>
      {/if}
      <span class="nav-label">{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 420px;
    height: 68px;
    background: var(--patti);
    border-top: 1px solid var(--nalupurugu);
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 var(--space-8);
    z-index: var(--z-nav);
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: var(--space-8);
    min-width: 56px;
    cursor: pointer;
    border: none;
    background: none;
    position: relative;
    color: var(--ink-tertiary);
    transition: color var(--dur-233) ease;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }

  .nav-item.active {
    color: var(--matti);
  }

  .nav-item.active::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 2px;
    background: var(--matti);
    border-radius: 0 0 2px 2px;
  }

  .nav-item :global(svg) {
    width: 22px;
    height: 22px;
    fill: currentColor;
    transition: transform var(--dur-233) var(--spring);
  }

  .nav-item:active :global(svg) {
    transform: scale(0.85);
  }

  .nav-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.3px;
    line-height: 1;
  }

  @media (max-width: 420px) {
    .bottom-nav { max-width: 100%; }
  }
</style>
