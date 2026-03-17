<script lang="ts">
  import { onMount } from 'svelte';
  import {
    fetchWeather,
    getCachedWeather,
    getFarmingAdvice,
    type WeatherData,
    type FarmingAdvice,
  } from '../lib/weather';

  interface Props {
    district?: string;
  }

  let { district = '' }: Props = $props();

  let data     = $state<WeatherData | null>(null);
  let advice   = $state<FarmingAdvice[]>([]);
  let loading  = $state(true);
  let error    = $state<string | null>(null);
  let visible  = $state(false);

  onMount(() => {
    // Show cached data instantly if available
    const cached = getCachedWeather();
    if (cached) {
      data    = cached;
      advice  = getFarmingAdvice(cached);
      loading = false;
      // Still refresh in background if we have cache
      refreshWeather(false);
    } else {
      refreshWeather(true);
    }

    // Fade in
    requestAnimationFrame(() => { visible = true; });
  });

  async function refreshWeather(showLoading: boolean) {
    if (showLoading) loading = true;
    error = null;
    try {
      const fresh = await fetchWeather(district || undefined);
      data    = fresh;
      advice  = getFarmingAdvice(fresh);
    } catch (e) {
      if (!data) {
        // Only show error if we have no cached data to show
        error = 'వాతావరణ సమాచారం అందలేదు';
      }
    } finally {
      loading = false;
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' });
  }

  // Forecast slice: today + next 5 days (skip 7th to keep compact)
  const forecastDays = $derived(data ? data.forecast.slice(0, 6) : []);
</script>

<div class="weather-card" class:visible>
  <!-- Header strip: current conditions -->
  {#if loading && !data}
    <div class="weather-skeleton">
      <div class="skel skel-temp"></div>
      <div class="skel skel-desc"></div>
      <div class="skel skel-meta"></div>
    </div>
  {:else if error && !data}
    <div class="weather-error">
      <span class="weather-error-icon">⚠️</span>
      <span class="weather-error-text">{error}</span>
      <button class="retry-btn" onclick={() => refreshWeather(true)}>మళ్ళీ ప్రయత్నించు</button>
    </div>
  {:else if data}
    <!-- Current weather row -->
    <div class="current-row">
      <div class="current-main">
        <span class="current-icon">{data.current.icon}</span>
        <span class="current-temp">{data.current.temperature}°</span>
        <div class="current-details">
          <div class="current-desc">{data.current.description}</div>
          <div class="current-meta">
            <span>💧 {data.current.humidity}%</span>
            <span class="meta-dot">·</span>
            <span>💨 {data.current.windSpeed} km/h</span>
            <span class="meta-dot">·</span>
            <span class="location-name">{data.location}</span>
          </div>
        </div>
      </div>
      {#if loading}
        <div class="refresh-spinner" title="వాతావరణ సమాచారం నవీకరిస్తున్నాము..."></div>
      {:else}
        <button
          class="refresh-btn"
          onclick={() => refreshWeather(false)}
          title="నవీకరించు"
          aria-label="వాతావరణ సమాచారం నవీకరించు"
        >↻</button>
      {/if}
    </div>

    <!-- 6-day forecast strip -->
    <div class="forecast-strip">
      {#each forecastDays as day, i}
        <div class="forecast-day" class:today={i === 0}>
          <div class="forecast-label">{i === 0 ? 'నేడు' : day.dayLabel}</div>
          <div class="forecast-icon">{day.icon}</div>
          <div class="forecast-temp-max">{day.tempMax}°</div>
          <div class="forecast-temp-min">{day.tempMin}°</div>
          {#if day.rain > 0}
            <div class="forecast-rain">{day.rain}mm</div>
          {:else}
            <div class="forecast-rain empty"></div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Farming advice (only show if any) -->
    {#if advice.length > 0}
      <div class="advice-section">
        {#each advice as tip}
          <div class="advice-row severity-{tip.severity}">
            <span class="advice-icon">{tip.icon}</span>
            <span class="advice-text">{tip.text}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Footer: last updated -->
    <div class="weather-footer">
      చివరి నవీకరణ: {formatTime(data.fetchedAt)}
    </div>
  {/if}
</div>

<style>
  .weather-card {
    margin: 0 var(--space-21) var(--space-8);
    background: var(--patti);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card);
    border-left: 4px solid var(--neeli);
    overflow: hidden;
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity var(--dur-377) var(--ease-out),
      transform var(--dur-377) var(--ease-out);
  }

  .weather-card.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Current conditions ──────────────────────────────── */
  .current-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-13) var(--space-21) var(--space-8);
    gap: var(--space-8);
  }

  .current-main {
    display: flex;
    align-items: center;
    gap: var(--space-13);
    min-width: 0;
  }

  .current-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .current-temp {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink-primary);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .current-details {
    min-width: 0;
  }

  .current-desc {
    font-family: var(--font-te-display);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .current-meta {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    margin-top: 2px;
    flex-wrap: wrap;
  }

  .meta-dot { opacity: 0.4; }

  .location-name {
    font-family: var(--font-te-display);
    color: var(--neeli);
    font-size: 10px;
  }

  .refresh-btn {
    width: 32px; height: 32px;
    background: transparent;
    border: 1px solid var(--nalupurugu);
    border-radius: 50%;
    color: var(--ink-tertiary);
    font-size: var(--text-base);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: color var(--dur-233) ease, background var(--dur-233) ease;
    padding: 0;
    line-height: 1;
  }

  .refresh-btn:hover {
    color: var(--neeli);
    background: var(--neeli-glow, rgba(27,79,114,0.08));
  }

  .refresh-btn:active {
    transform: scale(0.9);
    transition-duration: var(--dur-89);
  }

  .refresh-spinner {
    width: 20px; height: 20px;
    border: 2px solid var(--nalupurugu);
    border-top-color: var(--neeli);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── 6-day forecast strip ────────────────────────────── */
  .forecast-strip {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-top: 1px solid var(--nalupurugu-soft, rgba(212,197,169,0.5));
    border-bottom: 1px solid var(--nalupurugu-soft, rgba(212,197,169,0.5));
  }

  .forecast-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-8) var(--space-3);
    gap: 2px;
    border-right: 1px solid var(--nalupurugu-soft, rgba(212,197,169,0.5));
    transition: background var(--dur-144) ease;
  }

  .forecast-day:last-child { border-right: none; }

  .forecast-day.today {
    background: rgba(27, 79, 114, 0.05);
  }

  .forecast-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--ink-tertiary);
    letter-spacing: 0.3px;
    font-family: var(--font-te-display);
    text-align: center;
    line-height: 1.2;
  }

  .forecast-day.today .forecast-label {
    color: var(--neeli);
  }

  .forecast-icon {
    font-size: 1.1rem;
    line-height: 1;
    margin: 2px 0;
  }

  .forecast-temp-max {
    font-size: 11px;
    font-weight: 600;
    color: var(--erra, #c0392b);
    font-variant-numeric: tabular-nums;
  }

  .forecast-temp-min {
    font-size: 10px;
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
  }

  .forecast-rain {
    font-size: 9px;
    color: var(--neeli);
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
    min-height: 12px;
  }

  .forecast-rain.empty { min-height: 12px; }

  /* ── Farming advice ──────────────────────────────────── */
  .advice-section {
    padding: var(--space-8) var(--space-21) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .advice-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-8);
    padding: var(--space-5) var(--space-8);
    border-radius: 4px;
    border-left: 3px solid transparent;
  }

  .advice-row.severity-danger {
    background: var(--erra-soft, rgba(192,57,43,0.08));
    border-left-color: var(--erra, #c0392b);
  }

  .advice-row.severity-warning {
    background: rgba(232, 163, 23, 0.08);
    border-left-color: var(--pasupu, #E8A317);
  }

  .advice-row.severity-info {
    background: rgba(27, 79, 114, 0.06);
    border-left-color: var(--neeli, #1B4F72);
  }

  .advice-icon {
    font-size: var(--text-base);
    line-height: 1.4;
    flex-shrink: 0;
  }

  .advice-text {
    font-family: var(--font-te-display);
    font-size: var(--text-xs);
    color: var(--ink-secondary);
    line-height: 1.6;
  }

  /* ── Footer ──────────────────────────────────────────── */
  .weather-footer {
    padding: var(--space-5) var(--space-21) var(--space-8);
    font-size: 10px;
    color: var(--ink-faint);
    font-family: var(--font-mono);
    letter-spacing: 0.3px;
  }

  /* ── Skeleton loader ─────────────────────────────────── */
  .weather-skeleton {
    padding: var(--space-13) var(--space-21);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .skel {
    background: linear-gradient(
      90deg,
      var(--nalupurugu) 25%,
      rgba(212,197,169,0.4) 50%,
      var(--nalupurugu) 75%
    );
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 1.4s ease infinite;
  }

  .skel-temp  { height: 28px; width: 80px; }
  .skel-desc  { height: 14px; width: 160px; }
  .skel-meta  { height: 12px; width: 120px; }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Error state ─────────────────────────────────────── */
  .weather-error {
    padding: var(--space-13) var(--space-21);
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex-wrap: wrap;
  }

  .weather-error-icon { font-size: var(--text-base); }

  .weather-error-text {
    font-family: var(--font-te-display);
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
    flex: 1;
  }

  .retry-btn {
    font-size: var(--text-xs);
    color: var(--neeli);
    background: none;
    border: 1px solid var(--neeli);
    border-radius: 4px;
    padding: 3px var(--space-8);
    cursor: pointer;
    font-family: var(--font-te-display);
    transition: background var(--dur-144) ease;
  }

  .retry-btn:hover {
    background: rgba(27, 79, 114, 0.08);
  }

  /* ── Responsive ──────────────────────────────────────── */
  @media (max-width: 420px) {
    .weather-card {
      margin-left: var(--space-13);
      margin-right: var(--space-13);
    }

    .current-row {
      padding-left: var(--space-13);
      padding-right: var(--space-13);
    }

    .advice-section {
      padding-left: var(--space-13);
      padding-right: var(--space-13);
    }

    .weather-footer {
      padding-left: var(--space-13);
      padding-right: var(--space-13);
    }

    .forecast-day { padding: var(--space-5) 2px; }

    .forecast-label { font-size: 8px; }
    .forecast-icon  { font-size: 1rem; }
    .forecast-temp-max { font-size: 10px; }
    .forecast-temp-min { font-size: 9px; }
    .forecast-rain     { font-size: 8px; }
  }
</style>
