<script lang="ts">
  import { onMount } from 'svelte';
  import { cropFields, cropEvents } from '../lib/stores';

  interface Props {
    ontoast?: (message: string, type: string) => void;
  }

  let { ontoast }: Props = $props();
  let activeForm: string | null = $state(null);

  const eventDotClass: Record<string, string> = {
    pesticide: 'pest', irrigation: 'water', fertilizer: 'fertilizer',
    inspection: 'inspect', sowing: 'seed', harvest: 'seed', sale: 'seed',
  };
  const eventIcons: Record<string, string> = {
    pesticide: '🐛', irrigation: '💧', fertilizer: '🌿',
    inspection: '📸', sowing: '🌱', harvest: '🌾', sale: '💰',
  };

  function toggleForm(formId: string) {
    activeForm = activeForm === formId ? null : formId;
  }

  function saveForm(formId: string, message: string) {
    activeForm = null;
    ontoast?.(`✓ ${message}`, 'default');
  }

  // Cost breakdown data
  const costItems = [
    { label: 'విత్తనాలు', value: 640, color: 'var(--pasupu)', width: 15.2 },
    { label: 'ఎరువులు', value: 1200, color: 'var(--pacchi-light)', width: 28.6 },
    { label: 'కూలి', value: 1600, color: 'var(--matti-light)', width: 38.1 },
    { label: 'నీటిపారుదల', value: 450, color: 'var(--neeli-light)', width: 10.7 },
    { label: 'పురుగు మందు', value: 310, color: 'var(--erra)', width: 7.4 },
  ];

  onMount(() => {
    // Auto-scroll lifecycle to current stage
    const scroll = document.getElementById('lifecycleScroll');
    if (scroll) {
      setTimeout(() => {
        const containerW = scroll.offsetWidth;
        scroll.scrollTo({ left: Math.max(0, 280 - containerW / 2), behavior: 'smooth' });
      }, 900);
    }
  });
</script>

<!-- Header -->
<div class="panta-header">
  <div class="panta-title">పంట</div>
  <div class="field-selector">
    <div class="field-selector-text">
      <span class="field-selector-name">{$cropFields[0]?.name}</span>
      <span class="field-selector-sub">{$cropFields[0]?.acreage} ఎకరాలు · {$cropFields[0]?.village}</span>
    </div>
    <span class="field-selector-chevron">▾</span>
  </div>
</div>

<!-- Pest Alert -->
<div class="pest-alert" role="alert">
  <div class="pest-alert-title">
    <span>⚠️</span>
    <span>బోల్ వార్మ్ — 35% ప్రభావం</span>
  </div>
  <div class="pest-alert-treatment">
    చికిత్స: వేప నూనె పిచికారీ · మార్చి 12 వేయడం అయింది ✓
  </div>
  <div class="pest-alert-next">
    <span>🔍</span> తదుపరి పరిశీలన: 2 రోజుల్లో
  </div>
</div>

<!-- Lifecycle Timeline -->
<div class="lifecycle-scroll" id="lifecycleScroll">
  <div class="lifecycle-wrap">
    <svg viewBox="0 0 520 90" xmlns="http://www.w3.org/2000/svg" overflow="visible" aria-hidden="true">
      <path d="M 280 45 C 310 22, 345 68, 370 45 C 398 22, 432 68, 460 45" fill="none" stroke="#D4C5A9" stroke-width="2.5" stroke-linecap="round"/>
      <path class="lifecycle-path-done" d="M 60 45 C 88 22, 122 68, 150 45 C 178 22, 212 68, 240 45 C 258 32, 270 36, 280 45" fill="none" stroke="#B8860B" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
      <!-- Seed - completed -->
      <g transform="translate(60, 45)"><circle r="18" fill="#FAF7F0" stroke="#B8860B" stroke-width="2"/><polyline points="-6,0 -2,5 8,-6" fill="none" stroke="#B8860B" stroke-width="2.5" stroke-linecap="round"/></g>
      <!-- Plant - completed -->
      <g transform="translate(150, 45)"><circle r="18" fill="#FAF7F0" stroke="#B8860B" stroke-width="2"/><polyline points="-6,0 -2,5 8,-6" fill="none" stroke="#B8860B" stroke-width="2.5" stroke-linecap="round"/></g>
      <!-- Growth - current -->
      <g transform="translate(280, 45)"><circle r="20" fill="#FAF7F0" stroke="#2D6A4F" stroke-width="2.5"/><circle r="6" fill="#2D6A4F"/></g>
      <!-- Harvest - upcoming -->
      <g transform="translate(370, 45)"><circle r="18" fill="#FAF7F0" stroke="#D4C5A9" stroke-width="1.5"/><circle r="6" fill="#D4C5A9"/></g>
      <!-- Sale - upcoming -->
      <g transform="translate(460, 45)"><circle r="18" fill="#FAF7F0" stroke="#D4C5A9" stroke-width="1.5"/><circle r="6" fill="#D4C5A9"/></g>
    </svg>
    <div class="stage-labels">
      <div class="stage-label" style="left: 60px;"><span class="completed">విత్తు ✓</span></div>
      <div class="stage-label" style="left: 150px;"><span class="completed">నాటు ✓</span></div>
      <div class="stage-label" style="left: 280px;"><span class="current">పెరుగుదల ●</span></div>
      <div class="stage-label" style="left: 370px;"><span class="upcoming">కోత</span></div>
      <div class="stage-label" style="left: 460px;"><span class="upcoming">అమ్మకం</span></div>
    </div>
  </div>
</div>

<!-- Status Card -->
<div class="status-card">
  <div class="status-top">
    <div class="status-health"><div class="health-dot"></div><span class="health-label">మంచి స్థితి</span></div>
    <div class="status-weather">🌤 32°C · తేమ 45%</div>
  </div>
  <div class="status-grid">
    <div class="status-item"><span class="status-item-label">రోజులు</span><span class="status-item-value days">87 రోజులు</span></div>
    <div class="status-item"><span class="status-item-label">కోత అంచనా</span><span class="status-item-value">ఏప్రిల్ 15-20</span></div>
    <div class="status-item"><span class="status-item-label">పెట్టుబడి</span><span class="status-item-value cost">₹4,200</span></div>
  </div>
</div>

<!-- Quick Log -->
<div class="panta-section-header"><span class="panta-section-title">నమోదు చేయండి</span></div>
<div class="quick-log-row">
  <button class="log-btn" onclick={() => toggleForm('photo')}><span class="btn-emoji">📸</span><span>ఫోటో</span></button>
  <button class="log-btn" onclick={() => toggleForm('water')}><span class="btn-emoji">💧</span><span>నీరు</span></button>
  <button class="log-btn" onclick={() => toggleForm('fertilizer')}><span class="btn-emoji">🌿</span><span>ఎరువు</span></button>
  <button class="log-btn" onclick={() => toggleForm('pest')}><span class="btn-emoji">🐛</span><span>పురుగు</span></button>
</div>

<!-- Inline forms -->
{#if activeForm === 'photo'}
  <div class="inline-form open">
    <div class="inline-form-title">📸 పంట ఫోటో నమోదు</div>
    <div class="inline-form-row"><textarea placeholder="గమనికలు: పంట స్థితి, పురుగు చిహ్నాలు..."></textarea></div>
    <div class="inline-form-actions">
      <button class="btn-cancel" onclick={() => { activeForm = null; }}>రద్దు</button>
      <button class="btn-save" onclick={() => saveForm('photo', 'ఫోటో నమోదు అయింది')}>📸 సేవ్</button>
    </div>
  </div>
{/if}
{#if activeForm === 'water'}
  <div class="inline-form open">
    <div class="inline-form-title">💧 నీటిపారుదల నమోదు</div>
    <div class="inline-form-row"><input type="text" placeholder="వ్యవధి (గంటలు) — ఉదా: 2"></div>
    <div class="inline-form-actions">
      <button class="btn-cancel" onclick={() => { activeForm = null; }}>రద్దు</button>
      <button class="btn-save" onclick={() => saveForm('water', 'నీటిపారుదల నమోదు అయింది')}>💧 సేవ్</button>
    </div>
  </div>
{/if}
{#if activeForm === 'fertilizer'}
  <div class="inline-form open">
    <div class="inline-form-title">🌿 ఎరువు నమోదు</div>
    <div class="inline-form-row"><input type="text" placeholder="రకం — ఉదా: DAP"><input type="text" placeholder="పరిమాణం — ఉదా: 2 బస్తాలు"></div>
    <div class="inline-form-actions">
      <button class="btn-cancel" onclick={() => { activeForm = null; }}>రద్దు</button>
      <button class="btn-save" onclick={() => saveForm('fertilizer', 'ఎరువు నమోదు అయింది')}>🌿 సేవ్</button>
    </div>
  </div>
{/if}
{#if activeForm === 'pest'}
  <div class="inline-form open">
    <div class="inline-form-title">🐛 పురుగు నమోదు</div>
    <div class="inline-form-row"><input type="text" placeholder="పురుగు పేరు"><input type="text" placeholder="ప్రభావం %"></div>
    <div class="inline-form-actions">
      <button class="btn-cancel" onclick={() => { activeForm = null; }}>రద్దు</button>
      <button class="btn-save" onclick={() => saveForm('pest', 'పురుగు నమోదు అయింది')}>🐛 సేవ్</button>
    </div>
  </div>
{/if}

<!-- Journal -->
<div class="panta-section-header"><span class="panta-section-title">పంట జర్నల్</span><span class="panta-section-action">అన్నీ →</span></div>
<div class="event-journal">
  <div class="journal-line"></div>
  {#each $cropEvents as evt, i}
    <div class="journal-event" style="animation: cardSlideIn var(--dur-610) var(--ease-out) {i * 144}ms both;">
      <div class="event-dot {eventDotClass[evt.kind] || 'seed'}">{eventIcons[evt.kind] || '📝'}</div>
      <div class="event-card">
        <div class="event-date">{evt.date}</div>
        <div class="event-title">{evt.title}</div>
        <div class="event-body">{@html evt.body.replace(/\n/g, '<br>')}</div>
        {#if evt.badge}
          <div class="event-badge">{evt.badge}</div>
        {/if}
        {#if evt.photos.length > 0}
          <div class="journal-photos">
            {#each evt.photos as _photo}
              <div class="photo-thumb">📷</div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<!-- Cost Breakdown -->
<div class="panta-section-header"><span class="panta-section-title">పెట్టుబడి వివరాలు</span></div>
<div class="cost-breakdown">
  {#each costItems as item}
    <div class="cost-row">
      <span class="cost-label"><span class="cost-dot" style="background: {item.color};"></span>{item.label}</span>
      <span class="cost-value">₹{item.value.toLocaleString('en-IN')}</span>
    </div>
  {/each}
  <div class="cost-total">
    <span class="cost-label">మొత్తం పెట్టుబడి</span>
    <span class="cost-value" style="color: var(--ittadi);">₹4,200</span>
  </div>
  <div class="cost-bar-track">
    {#each costItems as item}
      <div class="cost-bar-segment" style="width: {item.width}%; background: {item.color};"></div>
    {/each}
  </div>
</div>

<div class="bottom-spacer"></div>

<style>
  .panta-header { padding: var(--space-13) var(--space-21) var(--space-8); display: flex; align-items: center; justify-content: space-between; gap: var(--space-13); }
  .panta-title { font-family: var(--font-te-display); font-size: var(--text-xl); font-weight: 400; color: var(--ink-primary); animation: fadeUp var(--dur-610) var(--spring) 200ms both; }
  .field-selector { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) var(--space-13); background: var(--patti-warm); border: 1px solid var(--nalupurugu); border-radius: 2px 8px 3px 5px; cursor: pointer; font-size: var(--text-xs); max-width: 200px; animation: fadeUp var(--dur-610) var(--spring) 350ms both; }
  .field-selector-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .field-selector-name { font-weight: 600; color: var(--ink-primary); font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .field-selector-sub { font-size: 10px; color: var(--ink-tertiary); white-space: nowrap; }
  .field-selector-chevron { font-size: 10px; color: var(--ink-tertiary); flex-shrink: 0; }

  .pest-alert { margin: 0 var(--space-21) var(--space-13); padding: var(--space-13) var(--space-21); background: var(--erra-soft); border: 1.5px solid rgba(192, 57, 43, 0.25); border-left: 4px solid var(--erra); border-radius: 3px 8px 5px 3px; animation: fadeUp var(--dur-610) var(--ease-out) 500ms both; }
  .pest-alert-title { font-size: var(--text-sm); font-weight: 600; color: var(--erra); display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-5); }
  .pest-alert-treatment { font-size: var(--text-xs); color: var(--ink-secondary); line-height: 1.5; margin-bottom: var(--space-3); }
  .pest-alert-next { font-size: var(--text-xs); color: var(--ink-tertiary); font-family: var(--font-mono); display: flex; align-items: center; gap: var(--space-5); }

  .lifecycle-scroll { overflow-x: auto; overflow-y: visible; padding: var(--space-34) var(--space-21) var(--space-21); scrollbar-width: none; animation: fadeUp var(--dur-610) var(--ease-out) 650ms both; }
  .lifecycle-scroll::-webkit-scrollbar { display: none; }
  .lifecycle-wrap { position: relative; width: 520px; height: 110px; }
  .lifecycle-wrap :global(svg) { position: absolute; top: 0; left: 0; width: 520px; height: 90px; overflow: visible; }
  .lifecycle-path-done { stroke-dasharray: 700; stroke-dashoffset: 700; animation: pathDraw 0.9s var(--ease-out) 700ms forwards; }
  @keyframes pathDraw { from { stroke-dashoffset: 700; } to { stroke-dashoffset: 0; } }
  .stage-labels { position: absolute; bottom: 0; left: 0; width: 520px; }
  .stage-label { position: absolute; text-align: center; transform: translateX(-50%); font-size: 11px; line-height: 1.3; pointer-events: none; top: 72px; font-weight: 500; display: block; white-space: nowrap; }
  .stage-label .completed { color: var(--ittadi); }
  .stage-label .current { color: var(--pacchi); font-weight: 700; }
  .stage-label .upcoming { color: var(--ink-faint); }

  .status-card { margin: 0 var(--space-21) var(--space-13); padding: var(--space-21); background: linear-gradient(135deg, var(--patti-warm) 0%, var(--patti) 100%); border: 1px solid var(--nalupurugu); border-radius: 3px 13px 5px 8px; position: relative; overflow: hidden; animation: fadeUp var(--dur-610) var(--ease-out) 900ms both; }
  .status-card::before { content: ''; position: absolute; top: -1px; left: var(--space-21); width: 50px; height: 3px; background: var(--pacchi); border-radius: 0 0 2px 2px; }
  .status-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-13); }
  .status-health { display: flex; align-items: center; gap: var(--space-8); }
  .health-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pacchi-light); flex-shrink: 0; }
  .health-label { font-size: var(--text-sm); font-weight: 600; color: var(--pacchi); }
  .status-weather { font-size: var(--text-xs); color: var(--ink-tertiary); text-align: right; }
  .status-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-13); padding-top: var(--space-13); border-top: 1px solid var(--nalupurugu); }
  .status-item { display: flex; flex-direction: column; gap: var(--space-3); }
  .status-item-label { font-size: 10px; color: var(--ink-tertiary); text-transform: uppercase; letter-spacing: 0.8px; }
  .status-item-value { font-size: var(--text-sm); font-weight: 600; color: var(--ink-primary); font-variant-numeric: tabular-nums; }
  .status-item-value.days { font-family: var(--font-te-display); font-size: var(--text-lg); color: var(--matti); }
  .status-item-value.cost { color: var(--ittadi); }

  .panta-section-header { padding: var(--space-21) var(--space-21) var(--space-8); display: flex; justify-content: space-between; align-items: baseline; }
  .panta-section-title { font-family: var(--font-te-display); font-size: var(--text-lg); font-weight: 400; color: var(--ink-primary); }
  .panta-section-action { font-size: var(--text-xs); color: var(--neeli); cursor: pointer; }

  .quick-log-row { display: flex; gap: var(--space-8); padding: 0 var(--space-21) var(--space-13); overflow-x: auto; scrollbar-width: none; animation: fadeUp var(--dur-610) var(--ease-out) 1100ms both; }
  .log-btn { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-8) var(--space-13); background: var(--patti-warm); border: 1px solid var(--nalupurugu); cursor: pointer; font-family: var(--font-te); font-size: var(--text-xs); font-weight: 500; color: var(--ink-secondary); white-space: nowrap; position: relative; overflow: hidden; flex-shrink: 0; transition: background var(--dur-233) ease, transform var(--dur-233) var(--spring); }
  .log-btn:nth-child(1) { border-radius: 2px 10px 4px 6px; }
  .log-btn:nth-child(2) { border-radius: 6px 3px 8px 2px; }
  .log-btn:nth-child(3) { border-radius: 4px 8px 2px 10px; }
  .log-btn:nth-child(4) { border-radius: 8px 2px 6px 4px; }
  .log-btn:hover { background: #EDE8DB; transform: translateY(-1px); }
  .btn-emoji { font-size: 16px; }

  .inline-form { margin: 0 var(--space-21) var(--space-13); padding: var(--space-13) var(--space-21); background: var(--patti-warm); border: 1px solid var(--nalupurugu); border-top: 2px solid var(--pacchi); border-radius: 2px 8px 3px 5px; display: flex; flex-direction: column; gap: var(--space-8); animation: expandForm var(--dur-377) var(--spring) forwards; }
  @keyframes expandForm { from { opacity: 0; transform: scaleY(0.75); } to { opacity: 1; transform: scaleY(1); } }
  .inline-form-title { font-size: var(--text-sm); font-weight: 600; color: var(--pacchi); }
  .inline-form-row { display: flex; gap: var(--space-8); align-items: center; }
  .inline-form input, .inline-form textarea { flex: 1; padding: var(--space-8) var(--space-13); background: var(--patti); border: 1px solid var(--nalupurugu); border-radius: 3px 8px 3px 5px; font-family: var(--font-te); font-size: var(--text-sm); color: var(--ink-primary); outline: none; }
  .inline-form textarea { resize: none; height: 60px; }
  .inline-form-actions { display: flex; gap: var(--space-8); justify-content: flex-end; padding-top: var(--space-5); }
  .btn-save { padding: var(--space-8) var(--space-21); background: var(--pacchi); color: var(--patti); border: none; border-radius: 2px 8px 3px 5px; font-family: var(--font-te); font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
  .btn-cancel { padding: var(--space-8) var(--space-13); background: transparent; color: var(--ink-tertiary); border: 1px solid var(--nalupurugu); border-radius: 2px 8px 3px 5px; font-family: var(--font-te); font-size: var(--text-sm); cursor: pointer; }

  .event-journal { padding: 0 var(--space-21); position: relative; }
  .journal-line { position: absolute; top: 17px; left: calc(var(--space-21) + 17px); width: 2px; bottom: 0; background: linear-gradient(to bottom, var(--nalupurugu) 80%, transparent 100%); pointer-events: none; }
  .journal-event { display: flex; gap: var(--space-13); padding-bottom: var(--space-21); position: relative; }
  .event-dot { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; position: relative; z-index: 1; border: 2px solid var(--patti); }
  .event-dot.pest { background: var(--erra-soft); box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.3); }
  .event-dot.water { background: rgba(41, 128, 185, 0.1); box-shadow: 0 0 0 2px rgba(41, 128, 185, 0.25); }
  .event-dot.fertilizer { background: rgba(45, 106, 79, 0.1); box-shadow: 0 0 0 2px rgba(45, 106, 79, 0.25); }
  .event-dot.inspect { background: var(--ittadi-glow); box-shadow: 0 0 0 2px rgba(184, 134, 11, 0.3); }
  .event-dot.seed { background: var(--pasupu-glow); box-shadow: 0 0 0 2px rgba(232, 163, 23, 0.35); }
  .event-card { flex: 1; background: var(--patti); border: 1px solid var(--nalupurugu); border-radius: 2px 8px 5px 5px; padding: var(--space-13); cursor: pointer; transition: transform var(--dur-377) var(--spring), box-shadow var(--dur-233) ease; }
  .event-card:hover { transform: translateX(3px); box-shadow: 0 4px 13px rgba(0, 0, 0, 0.06); }
  .event-date { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); letter-spacing: 0.8px; margin-bottom: var(--space-3); }
  .event-title { font-size: var(--text-sm); font-weight: 500; color: var(--ink-primary); margin-bottom: var(--space-5); }
  .event-body { font-size: var(--text-xs); color: var(--ink-secondary); line-height: 1.6; }
  .event-badge { display: inline-flex; align-items: center; gap: var(--space-3); margin-top: var(--space-8); padding: var(--space-3) var(--space-8); background: rgba(45, 106, 79, 0.08); border: 1px solid rgba(45, 106, 79, 0.2); border-radius: 20px; font-size: 10px; color: var(--pacchi); font-weight: 500; }
  .journal-photos { display: flex; gap: var(--space-8); margin-top: var(--space-8); }
  .photo-thumb { width: 56px; height: 56px; background: var(--patti-warm); border: 1px solid var(--nalupurugu); border-radius: 3px 8px 3px 5px; display: flex; align-items: center; justify-content: center; color: var(--ink-faint); font-size: 18px; cursor: pointer; flex-shrink: 0; }

  .cost-breakdown { margin: 0 var(--space-21) var(--space-13); padding: var(--space-21); background: var(--patti-warm); border: 1px solid var(--nalupurugu); border-radius: 3px 8px 5px 3px; animation: cardSlideIn var(--dur-610) var(--ease-out) both; }
  .cost-row { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) 0; border-bottom: 1px solid rgba(212, 197, 169, 0.4); }
  .cost-row:last-of-type { border-bottom: none; }
  .cost-total { padding-top: var(--space-13); border-top: 2px solid var(--nalupurugu); margin-top: var(--space-5); display: flex; align-items: center; justify-content: space-between; }
  .cost-label { font-size: var(--text-sm); color: var(--ink-secondary); display: flex; align-items: center; gap: var(--space-8); }
  .cost-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .cost-value { font-size: var(--text-sm); font-weight: 600; color: var(--ink-primary); font-variant-numeric: tabular-nums; }
  .cost-total .cost-label { font-weight: 700; font-size: var(--text-base); color: var(--ink-primary); }
  .cost-total .cost-value { font-size: var(--text-base); }
  .cost-bar-track { margin-top: var(--space-13); height: 8px; border-radius: 4px; overflow: hidden; display: flex; background: var(--nalupurugu); }
  .cost-bar-segment { height: 100%; transition: width var(--dur-987) var(--spring); }
  .cost-bar-segment:first-child { border-radius: 4px 0 0 4px; }
  .cost-bar-segment:last-child { border-radius: 0 4px 4px 0; }
</style>
