<script lang="ts">
  import { onMount } from 'svelte';
  import { myCropPrices, myFarmerContext, connected, liveMandiPrices } from '../lib/stores';
  import {
    computeCropSummaries,
    formatRupees,
    relativeTimeTelugu,
    teluguDateShort,
    buildMarketInsight,
  } from '../lib/market';
  import {
    getMandiApiKey,
    fetchAllMandiPrices,
    getCachedPrices,
    cachePrices,
    getCacheFreshness,
    filterForAP,
    mandiRecordsToStoreFormat,
    type FreshnessLabel,
  } from '../lib/mandi-api';
  import { showToast } from '../lib/toast';
  import { speakIfEnabled, buildPriceReadout, isTTSEnabled } from '../lib/tts';
  import { hasApiKey } from '../lib/sarvam';

  // ── State ──
  let activeCrop = $state('వేరుశెనగ');
  let selectedMandi = $state('');
  let trendCanvas = $state<HTMLCanvasElement>(undefined as any);
  let refreshing = $state(false);
  let lastRefreshTime = $state(new Date().toISOString().slice(0, 10));

  // ── Mandi API fetch progress ──
  let fetchProgress = $state<{ fetched: number; total: number } | null>(null);
  let freshness = $state<FreshnessLabel>('seed');

  // ── Crops from farmer context, with fallback ──
  const defaultCrops = [
    { id: 'వేరుశెనగ', label: 'వేరుశెనగ' },
    { id: 'పత్తి', label: 'పత్తి' },
    { id: 'మొక్కజొన్న', label: 'మొక్కజొన్న' },
    { id: 'కంది', label: 'కంది' },
  ];

  let crops = $derived.by(() => {
    const ctx = $myFarmerContext;
    if (ctx) {
      try {
        const parsed: string[] = JSON.parse(ctx.crops || '[]');
        if (parsed.length > 0) {
          return parsed.map(c => ({ id: c, label: c }));
        }
      } catch { /* fallback */ }
    }
    return defaultCrops;
  });

  // ── Derived summaries from live data (liveMandiPrices > STDB via myCropPrices) ──
  let allSummaries = $derived(computeCropSummaries($myCropPrices, activeCrop, selectedMandi));
  let currentSummary = $derived(allSummaries.find(s => s.crop === activeCrop) || null);
  let insight = $derived(currentSummary ? buildMarketInsight(currentSummary) : null);

  // ── Mandi list for selected crop ──
  let mandiList = $derived(currentSummary?.mandiComparison || []);

  // ── Hero card data ──
  let heroMandi = $derived(selectedMandi || currentSummary?.bestMandi || '');
  let heroPrice = $derived.by(() => {
    if (!currentSummary) return 0;
    if (selectedMandi) {
      const m = currentSummary.mandiComparison.find(mc => mc.mandi === selectedMandi);
      return m?.price || currentSummary.bestPrice;
    }
    return currentSummary.bestPrice;
  });

  // ── Trend chart ──
  let priceHistory = $derived(currentSummary?.priceHistory || []);

  function getMspForCrop(): number {
    return currentSummary?.mspPrice || 0;
  }

  // When crop or mandi changes, redraw chart
  $effect(() => {
    // Access reactive deps
    const _crop = activeCrop;
    const _mandi = selectedMandi;
    const _history = priceHistory;
    // Schedule redraw
    if (trendCanvas && _history.length > 0) {
      drawTrendChart();
    }
  });

  // ── Pull to refresh ──
  let touchStartY = 0;
  let pulling = $state(false);
  let pullDistance = $state(0);

  function onTouchStart(e: TouchEvent) {
    if (window.scrollY === 0) {
      touchStartY = e.touches[0].clientY;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (touchStartY === 0) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 10 && window.scrollY === 0) {
      pulling = true;
      pullDistance = Math.min(dy * 0.4, 80);
    }
  }

  function onTouchEnd() {
    if (pulling && pullDistance > 50) {
      handleRefresh();
    }
    pulling = false;
    pullDistance = 0;
    touchStartY = 0;
  }

  /** Load cached prices into the store (called on mount + after fetch) */
  function loadCacheIntoStore() {
    const cache = getCachedPrices();
    if (!cache || cache.records.length === 0) {
      freshness = 'seed';
      return;
    }
    const apRecords = filterForAP(cache.records);
    const storeRows = mandiRecordsToStoreFormat(apRecords);
    liveMandiPrices.set(storeRows);
    lastRefreshTime = cache.date;
    freshness = getCacheFreshness();
  }

  async function handleRefresh() {
    const apiKey = getMandiApiKey();
    if (!apiKey) {
      showToast('data.gov.in API కీ లేదు. Settings లో జోడించండి.', 'warning', 4000);
      return;
    }

    refreshing = true;
    fetchProgress = { fetched: 0, total: 0 };

    try {
      const records = await fetchAllMandiPrices(apiKey, (fetched, total) => {
        fetchProgress = { fetched, total };
      });

      // Cache and filter for AP
      cachePrices(records);
      const apRecords = filterForAP(records);
      const storeRows = mandiRecordsToStoreFormat(apRecords);
      liveMandiPrices.set(storeRows);
      lastRefreshTime = new Date().toISOString().slice(0, 10);
      freshness = 'live';
      showToast(`${apRecords.length} AP/Telangana ధరలు లోడ్ అయ్యాయి`, 'default', 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`ధరలు లోడ్ కాలేదు: ${msg}`, 'alert', 5000);
      // Keep showing whatever was in the store before
    } finally {
      refreshing = false;
      fetchProgress = null;
    }
  }

  // ── Trend chart drawing ──
  function drawTrendChart() {
    if (!trendCanvas || priceHistory.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const W = trendCanvas.parentElement?.clientWidth || 350;
    const H = 200;
    trendCanvas.width = W * dpr;
    trendCanvas.height = H * dpr;
    trendCanvas.style.width = W + 'px';
    trendCanvas.style.height = H + 'px';

    const ctx = trendCanvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const PAD_L = 50, PAD_R = 12, PAD_T = 24, PAD_B = 36;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const prices = priceHistory.map(p => p.price);
    const msp = getMspForCrop();
    const allVals = [...prices, msp].filter(v => v > 0);
    const minP = Math.floor(Math.min(...allVals) * 0.995);
    const maxP = Math.ceil(Math.max(...allVals) * 1.005);
    const range = maxP - minP || 1;

    function priceToY(p: number) { return PAD_T + chartH - ((p - minP) / range) * chartH; }
    function indexToX(i: number) { return PAD_L + (i / (prices.length - 1)) * chartW; }

    // Velocity for brush width
    const velocities = prices.map((p, i) => i === 0 ? 0 : Math.abs(p - prices[i - 1]));
    const maxVel = Math.max(...velocities) || 1;

    let startTime: number | null = null;
    const animDuration = 1200;

    function render(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / animDuration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const drawCount = Math.max(2, Math.floor(ease * prices.length));
      const pts = prices.slice(0, drawCount);

      ctx.clearRect(0, 0, W, H);

      // ── Y-axis labels ──
      ctx.save();
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(139, 125, 107, 0.7)';
      ctx.textAlign = 'right';
      const ySteps = 4;
      for (let i = 0; i <= ySteps; i++) {
        const val = minP + (range * i / ySteps);
        const y = priceToY(val);
        ctx.fillText(`₹${formatRupees(Math.round(val))}`, PAD_L - 6, y + 3);
        // Grid line
        ctx.strokeStyle = 'rgba(139, 125, 107, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();
      }
      ctx.restore();

      // ── MSP dashed line ──
      if (msp > 0 && msp >= minP && msp <= maxP) {
        const mspY = priceToY(msp);
        ctx.save();
        ctx.strokeStyle = 'rgba(41, 128, 185, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(PAD_L, mspY);
        ctx.lineTo(W - PAD_R, mspY);
        ctx.stroke();
        ctx.setLineDash([]);
        // MSP label
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(41, 128, 185, 0.8)';
        ctx.textAlign = 'left';
        ctx.fillText('MSP', W - PAD_R - 24, mspY - 4);
        ctx.restore();
      }

      // ── Fill gradient ──
      const fillGrad = ctx.createLinearGradient(0, PAD_T, 0, H - PAD_B);
      fillGrad.addColorStop(0, 'rgba(232, 163, 23, 0.14)');
      fillGrad.addColorStop(0.6, 'rgba(232, 163, 23, 0.05)');
      fillGrad.addColorStop(1, 'rgba(232, 163, 23, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(indexToX(0), priceToY(pts[0]));
      for (let i = 1; i < pts.length; i++) {
        const x0 = indexToX(i - 1), y0 = priceToY(pts[i - 1]);
        const x1 = indexToX(i), y1 = priceToY(pts[i]);
        const cpx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
      }
      ctx.lineTo(indexToX(pts.length - 1), H - PAD_B);
      ctx.lineTo(indexToX(0), H - PAD_B);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();

      // ── Turmeric brush strokes ──
      for (let i = 1; i < pts.length; i++) {
        const ageFactor = i / (pts.length - 1);
        const vel = velocities[i] / maxVel;
        const brushW = 1.5 + vel * 2.5;
        const alpha = 0.25 + ageFactor * 0.65;

        const x0 = indexToX(i - 1), y0 = priceToY(pts[i - 1]);
        const x1 = indexToX(i), y1 = priceToY(pts[i]);
        const cpx = (x0 + x1) / 2;

        ctx.save();
        ctx.strokeStyle = `rgba(184, 134, 11, ${alpha})`;
        ctx.lineWidth = brushW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
        ctx.stroke();
        ctx.restore();
      }

      // ── Current price dot ──
      if (pts.length >= 2) {
        const lastX = indexToX(pts.length - 1);
        const lastY = priceToY(pts[pts.length - 1]);
        ctx.save();
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#E8A317';
        ctx.shadowColor = 'rgba(232, 163, 23, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();

        // Price label at dot
        ctx.save();
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#E8A317';
        ctx.textAlign = 'center';
        ctx.fillText(`₹${formatRupees(pts[pts.length - 1])}`, lastX, lastY - 10);
        ctx.restore();
      }

      // ── Min/Max labels ──
      const maxIdx = prices.indexOf(Math.max(...pts));
      const minIdx = prices.indexOf(Math.min(...pts));
      if (maxIdx >= 0 && maxIdx < pts.length) {
        ctx.save();
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(45, 106, 79, 0.8)';
        ctx.textAlign = 'center';
        const mx = indexToX(maxIdx);
        const my = priceToY(Math.max(...pts));
        ctx.fillText(`▲₹${formatRupees(Math.max(...pts))}`, mx, my - 6);
        ctx.restore();
      }

      // ── Date axis labels ──
      ctx.save();
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(139, 125, 107, 0.8)';
      const dates = priceHistory.slice(0, drawCount);
      if (dates.length > 0) {
        ctx.textAlign = 'left';
        ctx.fillText(teluguDateShort(dates[0].date), PAD_L, H - 8);
        if (dates.length > 1) {
          ctx.textAlign = 'right';
          ctx.fillText(teluguDateShort(dates[dates.length - 1].date), W - PAD_R, H - 8);
        }
        // Mid label
        if (dates.length > 10) {
          const midIdx = Math.floor(dates.length / 2);
          ctx.textAlign = 'center';
          ctx.fillText(teluguDateShort(dates[midIdx].date), indexToX(midIdx), H - 8);
        }
      }
      ctx.restore();

      if (progress < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  onMount(() => {
    // Load cached mandi prices immediately (no API call, instant)
    loadCacheIntoStore();

    // Initial chart draw after a tick
    setTimeout(() => {
      if (priceHistory.length > 0) drawTrendChart();
    }, 500);

    const handleResize = () => { setTimeout(drawTrendChart, 200); };
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  });

  // ── Badge logic ──
  function getMandiTag(mandi: string): 'best-price' | 'nearest' | null {
    if (!currentSummary) return null;
    const mc = currentSummary.mandiComparison;
    if (mc.length === 0) return null;
    if (mc[0].mandi === mandi) return 'best-price';
    // Nearest = smallest distance
    const minDist = Math.min(...mc.filter(m => m.distanceKm > 0).map(m => m.distanceKm));
    const nearest = mc.find(m => m.distanceKm === minDist);
    if (nearest && nearest.mandi === mandi) return 'nearest';
    return null;
  }

  function selectMandi(mandi: string) {
    selectedMandi = selectedMandi === mandi ? '' : mandi;
  }

  // ── TTS: read hero price aloud ──
  let speakingPrice = $state(false);

  async function handleSpeakPrice() {
    if (!hasApiKey()) {
      showToast('API కీ సెట్ చేయబడలేదు. సెట్టింగ్స్‌లో నమోదు చేయండి.', 'warning', 4000);
      return;
    }
    if (!isTTSEnabled()) {
      showToast('ధ్వని నిర్ధారణ ఆపివేయబడింది. Settings లో ఆన్ చేయండి.', 'warning', 3000);
      return;
    }
    if (!heroMandi || heroPrice <= 0) return;
    speakingPrice = true;
    try {
      await speakIfEnabled(buildPriceReadout(heroMandi, activeCrop, heroPrice));
    } finally {
      speakingPrice = false;
    }
  }
</script>

<!-- Pull-to-refresh indicator -->
{#if pulling}
  <div class="pull-indicator" style="height: {pullDistance}px; opacity: {pullDistance / 80}">
    <div class="pull-spinner" class:active={pullDistance > 50}>
      {pullDistance > 50 ? '↻' : '↓'}
    </div>
    <span class="pull-text">{pullDistance > 50 ? 'వదలండి' : 'రిఫ్రెష్ కోసం లాగండి'}</span>
  </div>
{/if}

{#if refreshing}
  <div class="refresh-bar">
    <div class="refresh-bar-inner"></div>
  </div>
{/if}

{#if fetchProgress && fetchProgress.total > 0}
  <div class="fetch-progress">
    <span class="fetch-progress-text">
      {fetchProgress.fetched.toLocaleString('en-IN')} / {fetchProgress.total.toLocaleString('en-IN')} ధరలు లోడ్...
    </span>
    <div class="fetch-progress-bar">
      <div
        class="fetch-progress-fill"
        style="width: {Math.min((fetchProgress.fetched / fetchProgress.total) * 100, 100)}%"
      ></div>
    </div>
  </div>
{/if}

<!-- Container with touch handlers -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>

<!-- Crop Filter Pills -->
<nav class="crop-pills">
  {#each crops as crop}
    <button
      class="crop-pill"
      class:active={activeCrop === crop.id}
      onclick={() => { activeCrop = crop.id; selectedMandi = ''; }}
    >{crop.label}</button>
  {/each}
  <!-- Freshness indicator -->
  {#if freshness === 'live'}
    <span class="freshness-badge live" title="నేడు data.gov.in నుండి">నేటి ధరలు</span>
  {:else if freshness === 'yesterday'}
    <span class="freshness-badge yesterday" title="నిన్నటి కాషే">నిన్నటి ధరలు</span>
  {:else}
    <span class="freshness-badge seed" title="నమూనా డేటా">సీడ్ డేటా</span>
  {/if}
  <!-- Refresh button -->
  <button
    class="refresh-btn"
    class:spinning={refreshing}
    onclick={handleRefresh}
    disabled={refreshing}
    aria-label="refresh prices"
  >↻</button>
</nav>

<!-- Hero Price Card -->
{#if currentSummary}
  {@const s = currentSummary}
  {@const displayPrice = heroPrice}
  {@const trendDir = s.trend7d.direction}
  {@const trendAmt = s.trend7d.amountRupees}
  <article class="hero-price-card">
    <div class="hero-mandi-row">
      <span class="hero-mandi-name">{heroMandi} మండీ</span>
      <span class="hero-timestamp">{relativeTimeTelugu(lastRefreshTime)}</span>
    </div>
    <div class="hero-crop-name">{activeCrop}</div>
    <div class="hero-price-row">
      <div>
        <span class="hero-price">₹{formatRupees(displayPrice)}</span>
        <span class="price-unit">/ క్వింటాల్</span>
      </div>
      <button
        class="price-speak-btn"
        class:speaking={speakingPrice}
        onclick={handleSpeakPrice}
        aria-label="ధర చదవండి"
        type="button"
        title="ధర తెలుగులో చదవండి"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5zM14 3.23v2.06A7.003 7.003 0 0119 12c0 3.12-2.04 5.76-4.86 6.71v2.06A9.005 9.005 0 0021 12c0-4.08-2.72-7.52-6.44-8.63L14 3.23z"/>
        </svg>
      </button>
      {#if trendDir === 'up'}
        <span class="trend-badge up">↑ ₹{formatRupees(Math.abs(trendAmt))}</span>
      {:else if trendDir === 'down'}
        <span class="trend-badge down">↓ ₹{formatRupees(Math.abs(trendAmt))}</span>
      {:else}
        <span class="trend-badge flat">= స్థిరం</span>
      {/if}
    </div>
    <div class="msp-line">
      <span class="msp-label">MSP</span>
      <span class="msp-value">₹{formatRupees(s.mspPrice)}</span>
      <span class="msp-dot"></span>
      {#if s.aboveMsp}
        <span class="msp-diff above">₹{formatRupees(Math.abs(s.mspDiffRupees))} ఎక్కువ</span>
      {:else if s.mspDiffRupees < 0}
        <span class="msp-diff below">₹{formatRupees(Math.abs(s.mspDiffRupees))} తక్కువ</span>
      {:else}
        <span class="msp-diff equal">MSP సమానం</span>
      {/if}
    </div>
  </article>
{:else}
  <article class="hero-price-card empty-state">
    <div class="empty-icon">📊</div>
    <div class="empty-text">
      {$connected ? 'ధర డేటా లోడ్ అవుతోంది...' : 'ఇంటర్నెట్ కనెక్ట్ కాలేదు'}
    </div>
  </article>
{/if}

<!-- Trend Chart -->
<section class="trend-chart-card">
  <div class="chart-header-row">
    <span class="chart-title-text">30 రోజుల ట్రెండ్</span>
    {#if priceHistory.length > 0}
      <span class="chart-count">{priceHistory.length} రోజులు</span>
    {/if}
  </div>
  <div class="chart-wrap">
    {#if priceHistory.length >= 2}
      <canvas bind:this={trendCanvas} aria-label="{activeCrop} ధర చరిత్ర చార్ట్"></canvas>
    {:else}
      <div class="chart-empty">
        <span>చార్ట్ డేటా లేదు</span>
      </div>
    {/if}
  </div>
</section>

<!-- Market Insight Card -->
{#if insight}
  <section class="insight-card" class:positive={insight.sentiment === 'positive'} class:negative={insight.sentiment === 'negative'}>
    <h3 class="insight-title">మార్కెట్ సూచన</h3>
    {#each insight.lines as line}
      <p class="insight-line">{line}</p>
    {/each}
  </section>
{/if}

<!-- Mandi Comparison -->
<section class="mandi-section">
  <h2 class="mandi-section-title">మండీల పోలిక</h2>
  {#if mandiList.length > 0}
    <ul class="mandi-list">
      {#each mandiList as mc, idx}
        {@const tag = getMandiTag(mc.mandi)}
        {@const isSelected = selectedMandi === mc.mandi}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events, a11y_no_noninteractive_element_to_interactive_role -->
        <li
          class="mandi-row"
          class:best-price={tag === 'best-price'}
          class:nearest={tag === 'nearest'}
          class:selected={isSelected}
          onclick={() => selectMandi(mc.mandi)}
          onkeydown={(e) => { if (e.key === 'Enter') selectMandi(mc.mandi); }}
          role="button"
          tabindex="0"
          style="animation-delay: {idx * 89}ms"
        >
          <div class="mandi-row-inner">
            <div class="mandi-name-row">
              <span class="mandi-name">{mc.mandi}</span>
              {#if tag === 'nearest'}
                <span class="mandi-badge nearest-badge">సమీపం</span>
              {:else if tag === 'best-price'}
                <span class="mandi-badge best-price-badge">ఉత్తమ ధర</span>
              {/if}
            </div>
            <span class="mandi-price">₹{formatRupees(mc.price)}</span>
            {#if mc.distanceKm > 0}
              <span class="mandi-meta">{mc.distanceKm} కి.మీ దూరం</span>
            {/if}
            {#if mc.transportCost > 0}
              <span class="mandi-transport">రవాణా ~₹{formatRupees(mc.transportCost)}</span>
            {/if}
          </div>
          <!-- Price bar -->
          <div class="price-bar-track">
            <div
              class="price-bar-fill"
              class:bar-best={tag === 'best-price'}
              style="width: {mc.pct}%"
            ></div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty-mandis">మండీ డేటా లేదు</div>
  {/if}
</section>

<!-- Last updated footer -->
<div class="last-updated">
  <span>చివరి నవీకరణ: {relativeTimeTelugu(lastRefreshTime)}</span>
  {#if !$connected}
    <span class="offline-badge">ఆఫ్‌లైన్</span>
  {/if}
</div>

</div> <!-- end touch container -->

<div class="bottom-spacer"></div>

<style>
  /* ── Pull-to-refresh ── */
  .pull-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    overflow: hidden;
    transition: height 0.1s ease;
  }
  .pull-spinner {
    font-size: 20px;
    color: var(--pasupu);
    transition: transform var(--dur-233) ease;
  }
  .pull-spinner.active { transform: rotate(180deg); }
  .pull-text {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    font-family: var(--font-te);
  }

  .refresh-bar {
    height: 3px;
    background: var(--nalupurugu);
    overflow: hidden;
    position: relative;
  }
  .refresh-bar-inner {
    position: absolute;
    left: -30%;
    width: 30%;
    height: 100%;
    background: linear-gradient(90deg, transparent, var(--pasupu), transparent);
    animation: refreshSlide 1.2s ease-in-out infinite;
  }
  @keyframes refreshSlide {
    0% { left: -30%; }
    100% { left: 100%; }
  }

  /* ── Crop pills ── */
  .crop-pills {
    display: flex;
    gap: var(--space-8);
    padding: var(--space-13) var(--space-21);
    overflow-x: auto;
    scrollbar-width: none;
    align-items: center;
  }
  .crop-pills::-webkit-scrollbar { display: none; }
  .crop-pill {
    flex-shrink: 0;
    padding: var(--space-5) var(--space-13);
    border-radius: 2px 8px 3px 6px;
    border: 1.5px solid var(--nalupurugu);
    background: var(--patti);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-secondary);
    cursor: pointer;
    transition: transform var(--dur-233) var(--spring),
      background var(--dur-233) ease,
      border-color var(--dur-233) ease,
      color var(--dur-233) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .crop-pill.active {
    background: var(--pasupu);
    border-color: var(--ittadi);
    color: #fff;
    font-weight: 600;
    box-shadow: 0 2px 10px rgba(232, 163, 23, 0.40);
  }
  .crop-pill:active { transform: scale(0.90); transition-duration: var(--dur-89); }

  .refresh-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1.5px solid var(--nalupurugu);
    background: var(--patti);
    font-size: 16px;
    color: var(--ink-secondary);
    cursor: pointer;
    transition: transform var(--dur-233) ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
  }
  .refresh-btn.spinning {
    animation: spin 0.8s linear infinite;
    color: var(--pasupu);
  }
  .refresh-btn:active { transform: scale(0.85); }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Hero Price Card ── */
  .hero-price-card {
    margin: var(--space-5) var(--space-21) var(--space-13);
    padding: var(--space-21);
    background: linear-gradient(135deg, var(--patti-warm) 0%, var(--patti) 100%);
    border: 1px solid var(--nalupurugu);
    border-radius: 3px 13px 5px 8px;
    position: relative;
    overflow: hidden;
    animation: fadeUp var(--dur-610) var(--ease-out) 500ms both;
  }
  .hero-price-card::before {
    content: '';
    position: absolute;
    top: -1px;
    left: var(--space-21);
    width: 55px;
    height: 3px;
    background: linear-gradient(90deg, var(--ittadi), var(--pasupu), var(--ittadi));
    border-radius: 0 0 2px 2px;
  }
  .hero-price-card.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-34);
  }
  .empty-icon { font-size: 32px; opacity: 0.5; }
  .empty-text { font-family: var(--font-te); font-size: var(--text-sm); color: var(--ink-tertiary); }

  .hero-mandi-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-8);
  }
  .hero-mandi-name {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-family: var(--font-mono);
  }
  .hero-timestamp {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-family: var(--font-mono);
  }
  .hero-crop-name {
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink-secondary);
    margin-bottom: var(--space-5);
  }
  .hero-price-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-13);
    margin-bottom: var(--space-8);
  }
  .hero-price {
    font-family: var(--font-te-display);
    font-size: var(--text-hero);
    font-weight: 700;
    color: var(--ink-primary);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -1px;
  }
  .price-unit {
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--ink-tertiary);
    margin-bottom: 4px;
  }
  .price-speak-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--pasupu-glow, rgba(232, 163, 23, 0.12));
    color: var(--ittadi);
    border: 1.5px solid rgba(232, 163, 23, 0.25);
    cursor: pointer;
    transition: color var(--dur-233) ease, background var(--dur-233) ease, transform var(--dur-233) var(--spring);
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .price-speak-btn:hover {
    background: var(--pasupu, #E8A317);
    color: #fff;
    border-color: var(--pasupu);
  }
  .price-speak-btn:active {
    transform: scale(0.88);
  }
  .price-speak-btn.speaking {
    color: var(--pasupu);
    animation: breathePulse-speak 1.2s ease-in-out infinite;
  }
  @keyframes breathePulse-speak {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .trend-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-8);
    border-radius: 4px 10px 4px 6px;
    font-size: var(--text-xs);
    font-weight: 600;
    font-family: var(--font-mono);
    margin-left: auto;
  }
  .trend-badge.up { background: var(--pacchi-soft); color: var(--pacchi); }
  .trend-badge.down { background: var(--erra-soft); color: var(--erra); }
  .trend-badge.flat { background: var(--nalupurugu); color: var(--ink-tertiary); }

  .msp-line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    margin-top: var(--space-13);
    padding-top: var(--space-13);
    border-top: 1px solid rgba(212, 197, 169, 0.5);
    flex-wrap: wrap;
  }
  .msp-label { font-size: var(--text-xs); color: var(--ink-tertiary); font-family: var(--font-mono); }
  .msp-value { font-size: var(--text-xs); font-family: var(--font-mono); font-weight: 600; color: var(--neeli); }
  .msp-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--nalupurugu); }
  .msp-diff {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    padding: 2px var(--space-5);
    border-radius: 3px;
  }
  .msp-diff.below { background: var(--erra-soft); color: var(--erra); }
  .msp-diff.above { background: var(--pacchi-soft); color: var(--pacchi); }
  .msp-diff.equal { background: var(--nalupurugu); color: var(--ink-tertiary); }

  /* ── Trend chart ── */
  .trend-chart-card {
    margin: 0 var(--space-21) var(--space-13);
    padding: var(--space-13);
    background: var(--patti);
    border: 1px solid var(--nalupurugu);
    border-radius: 2px 10px 3px 6px;
    animation: cardSlideIn var(--dur-987) var(--ease-out) both;
  }
  .chart-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-8);
    padding: 0 var(--space-8);
  }
  .chart-title-text {
    font-family: var(--font-te-display);
    font-size: var(--text-sm);
    color: var(--ink-primary);
  }
  .chart-count {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-family: var(--font-mono);
  }
  .chart-wrap { position: relative; width: 100%; }
  .chart-wrap canvas {
    display: block;
    width: 100%;
    height: 200px;
    border-radius: 2px 6px 2px 4px;
    cursor: crosshair;
  }
  .chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
    color: var(--ink-faint);
    font-family: var(--font-te);
    font-size: var(--text-sm);
  }

  /* ── Insight card ── */
  .insight-card {
    margin: 0 var(--space-21) var(--space-13);
    padding: var(--space-13) var(--space-21);
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-left: 3px solid var(--neeli);
    border-radius: 2px 8px 3px 5px;
    animation: cardSlideIn var(--dur-987) var(--ease-out) 200ms both;
  }
  .insight-card.positive { border-left-color: var(--pacchi); }
  .insight-card.negative { border-left-color: var(--erra); }
  .insight-title {
    font-family: var(--font-te-display);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    margin-bottom: var(--space-8);
    font-weight: 600;
  }
  .insight-line {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-secondary);
    line-height: 1.6;
    margin: 0 0 var(--space-3);
  }

  /* ── Mandi section ── */
  .mandi-section {
    margin: 0 var(--space-21) var(--space-13);
    animation: cardSlideIn var(--dur-987) var(--ease-out) both;
  }
  .mandi-section-title {
    font-family: var(--font-te-display);
    font-size: var(--text-base);
    color: var(--ink-primary);
    margin-bottom: var(--space-13);
  }
  .mandi-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    list-style: none;
  }
  .mandi-row {
    padding: var(--space-13);
    border: 1px solid var(--nalupurugu);
    border-radius: 2px 8px 3px 5px;
    background: var(--patti);
    cursor: pointer;
    transition: transform var(--dur-233) var(--spring),
      box-shadow var(--dur-233) ease,
      border-color var(--dur-233) ease;
    animation: fadeUp var(--dur-610) var(--ease-out) both;
  }
  .mandi-row:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 13px rgba(0, 0, 0, 0.06);
  }
  .mandi-row.selected {
    border-color: var(--pasupu);
    box-shadow: 0 0 0 2px rgba(232, 163, 23, 0.2);
  }
  .mandi-row.best-price {
    border-color: rgba(45, 106, 79, 0.35);
    background: linear-gradient(135deg, var(--pacchi-soft) 0%, var(--patti) 100%);
  }
  .mandi-row.nearest {
    border-color: var(--pasupu-soft);
    background: linear-gradient(135deg, var(--pasupu-glow) 0%, var(--patti) 100%);
  }
  .mandi-row-inner {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-3) 0;
  }
  .mandi-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    grid-column: 1;
    grid-row: 1;
  }
  .mandi-name { font-size: var(--text-sm); font-weight: 500; color: var(--ink-primary); }
  .mandi-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px var(--space-5);
    border-radius: 2px 5px 2px 3px;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }
  .nearest-badge { background: var(--pasupu-glow); color: var(--ittadi); }
  .best-price-badge { background: var(--pacchi-soft); color: var(--pacchi); }
  .mandi-price {
    font-size: var(--text-base);
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    grid-column: 2;
    grid-row: 1;
    text-align: right;
    align-self: center;
  }
  .mandi-row.best-price .mandi-price { color: var(--pacchi); }
  .mandi-row.nearest .mandi-price { color: var(--ittadi); }
  .mandi-meta {
    font-size: 11px;
    color: var(--ink-faint);
    font-family: var(--font-mono);
    grid-column: 1;
    grid-row: 2;
  }
  .mandi-transport {
    font-size: 11px;
    color: var(--ink-tertiary);
    font-family: var(--font-mono);
    grid-column: 2;
    grid-row: 2;
    text-align: right;
  }

  /* ── Price comparison bar ── */
  .price-bar-track {
    height: 4px;
    background: var(--nalupurugu);
    border-radius: 2px;
    margin-top: var(--space-8);
    overflow: hidden;
  }
  .price-bar-fill {
    height: 100%;
    background: var(--pasupu);
    border-radius: 2px;
    transition: width var(--dur-987) var(--spring);
  }
  .price-bar-fill.bar-best {
    background: linear-gradient(90deg, var(--pacchi), var(--pacchi-soft));
  }

  .empty-mandis {
    text-align: center;
    color: var(--ink-faint);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    padding: var(--space-21);
  }

  /* ── Last updated footer ── */
  .last-updated {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    padding: var(--space-8) var(--space-21);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-family: var(--font-mono);
  }
  .offline-badge {
    background: var(--erra-soft);
    color: var(--erra);
    padding: 1px var(--space-5);
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
  }

  .bottom-spacer { height: 120px; }

  /* ── Fetch progress ── */
  .fetch-progress {
    padding: var(--space-5) var(--space-21);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .fetch-progress-text {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    font-family: var(--font-mono);
  }
  .fetch-progress-bar {
    height: 3px;
    background: var(--nalupurugu);
    border-radius: 2px;
    overflow: hidden;
  }
  .fetch-progress-fill {
    height: 100%;
    background: var(--pasupu);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  /* ── Freshness badge ── */
  .freshness-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    font-family: var(--font-mono);
    padding: 2px var(--space-5);
    border-radius: 3px;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .freshness-badge.live {
    background: var(--pacchi-soft);
    color: var(--pacchi);
  }
  .freshness-badge.yesterday {
    background: var(--pasupu-glow);
    color: var(--ittadi);
  }
  .freshness-badge.seed {
    background: var(--nalupurugu);
    color: var(--ink-tertiary);
  }
</style>
