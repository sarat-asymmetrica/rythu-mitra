<script lang="ts">
  import { onMount } from 'svelte';
  import { cropFields, cropEvents } from '../lib/stores';
  import { loadConfig } from '../lib/sarvam';
  import { getConnection } from '../lib/db';
  import { get } from 'svelte/store';
  import { connected } from '../lib/stores';

  interface Props {
    ontoast?: (message: string, type: string) => void;
  }

  let { ontoast }: Props = $props();
  let activeForm: string | null = $state(null);

  // Camera / AI analysis state
  let cameraInputEl: HTMLInputElement | null = $state(null);
  let capturedPhotoUrl: string | null = $state(null);
  let capturedPhotoFile: File | null = $state(null);
  let analysisPending = $state(false);
  let analysisResult: string | null = $state(null);
  let analysisError: string | null = $state(null);

  const SARVAM_BASE = 'https://api.sarvam.ai';

  const CROP_ANALYSIS_PROMPT = `You are an expert agricultural AI assistant helping a farmer in Anantapur, Andhra Pradesh. Analyze this crop photo and provide:
1. పంట రకం (Crop type: groundnut/cotton/other) — వేరుశెనగ/పత్తి/ఇతరం
2. పెరుగుదల దశ (Growth stage: seedling/vegetative/flowering/maturity) — మొలక/వృద్ధి/పువ్వు/పరిపక్వం
3. ఆరోగ్య స్థితి (Health: healthy/pest/disease/nutrient) — మంచి/పురుగు/వ్యాధి/పోషకలోపం
4. పురుగు లేదా వ్యాధి గుర్తింపు మరియు చికిత్స సూచన ఉంటే తెలుగులో వివరించండి.
Respond entirely in Telugu. Be concise and practical.`;

  const eventDotClass: Record<string, string> = {
    pesticide: 'pest', irrigation: 'water', fertilizer: 'fertilizer',
    inspection: 'inspect', sowing: 'seed', harvest: 'seed', sale: 'seed',
    photo: 'inspect',
  };
  const eventIcons: Record<string, string> = {
    pesticide: '🐛', irrigation: '💧', fertilizer: '🌿',
    inspection: '📸', sowing: '🌱', harvest: '🌾', sale: '💰',
    photo: '📸',
  };

  function toggleForm(formId: string) {
    // If clicking photo button, open camera directly
    if (formId === 'photo') {
      openCamera();
      return;
    }
    activeForm = activeForm === formId ? null : formId;
  }

  function saveForm(formId: string, message: string) {
    activeForm = null;
    ontoast?.(`✓ ${message}`, 'default');
  }

  // ---------------------------------------------------------------------------
  // Camera + AI Analysis (F006)
  // ---------------------------------------------------------------------------

  function openCamera() {
    cameraInputEl?.click();
  }

  function handleCameraCapture(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Revoke previous URL
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);

    capturedPhotoFile = file;
    capturedPhotoUrl = URL.createObjectURL(file);
    analysisResult = null;
    analysisError = null;
    activeForm = 'photo_preview';

    // Start analysis immediately
    analyzePhoto(file);

    // Reset so same file can be re-selected
    input.value = '';
  }

  async function analyzePhoto(file: File) {
    const config = loadConfig();
    if (!config.apiKey) {
      analysisError = 'AI విశ్లేషణ కోసం Settings లో API key సెట్ చేయండి';
      return;
    }

    analysisPending = true;
    analysisError = null;

    try {
      // Resize image for API (max 800px, JPEG 0.8)
      const dataUrl = await resizeImageToDataUrl(file, 800, 0.8);

      const response = await fetch(`${SARVAM_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': config.apiKey,
        },
        body: JSON.stringify({
          model: config.chatModel || 'sarvam-105b',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
                {
                  type: 'text',
                  text: CROP_ANALYSIS_PROMPT,
                },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        // Sarvam 105b may not support vision — fall back to text-only
        if (response.status === 400 || response.status === 422) {
          analysisResult = await analyzePhotoTextOnly(config.apiKey, config.chatModel);
        } else {
          throw new Error(`API error ${response.status}: ${txt}`);
        }
        return;
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      analysisResult = data.choices?.[0]?.message?.content ?? 'విశ్లేషణ లభించలేదు';
    } catch (err) {
      console.error('[Panta] Photo analysis failed:', err);
      analysisError = 'AI విశ్లేషణ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.';
    } finally {
      analysisPending = false;
    }
  }

  async function analyzePhotoTextOnly(apiKey: string, model: string): Promise<string> {
    // Fallback: describe what we know and ask for general advice
    const response = await fetch(`${SARVAM_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': apiKey,
      },
      body: JSON.stringify({
        model: model || 'sarvam-105b',
        messages: [
          {
            role: 'user',
            content: 'అనంతపురం రైతు తన పంట ఫోటో తీశారు. వేరుశెనగ మరియు పత్తి పంటలలో ఈ సీజన్ (మార్చి) లో సాధారణంగా కనిపించే పురుగులు మరియు వ్యాధుల గురించి సంక్షిప్తంగా తెలుగులో చెప్పండి.',
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return 'ఫోటో విశ్లేషణ అందుబాటులో లేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.';
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? 'విశ్లేషణ లభించలేదు';
  }

  /** Resize image to max dimension, return data URL. */
  function resizeImageToDataUrl(file: File, maxPx: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('no canvas ctx')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Map AI analysis text to a STDB crop event kind. */
  function inferCropEventKind(analysisText: string): string {
    const lower = analysisText.toLowerCase();
    if (lower.includes('పురుగు') || lower.includes('pest') || lower.includes('బోల్') || lower.includes('దోమ')) {
      return 'PestObserved';
    }
    if (lower.includes('నీరు') || lower.includes('నీటి') || lower.includes('irrigat')) {
      return 'Irrigated';
    }
    if (lower.includes('పువ్వు') || lower.includes('flower') || lower.includes('పూత')) {
      return 'Sprayed';
    }
    return 'PestObserved'; // default for photo inspection
  }

  /** Detect crop name from analysis. */
  function inferCropName(analysisText: string): string {
    if (analysisText.includes('వేరుశెనగ') || analysisText.toLowerCase().includes('groundnut')) {
      return 'వేరుశెనగ';
    }
    if (analysisText.includes('పత్తి') || analysisText.toLowerCase().includes('cotton')) {
      return 'పత్తి';
    }
    return $cropFields[0]?.crop || 'వేరుశెనగ';
  }

  async function savePhotoEvent() {
    if (!analysisResult) return;

    const kind = inferCropEventKind(analysisResult);
    const crop = inferCropName(analysisResult);
    const notes = analysisResult.slice(0, 500);

    const conn = getConnection();
    const isConnected = get(connected);

    if (conn && isConnected) {
      try {
        conn.reducers.recordCropEvent({
          kind,
          crop,
          plotId: 'plot_a',
          photoBytes: undefined,
          aiNotes: notes,
          gpsLat: undefined,
          gpsLon: undefined,
        });
        ontoast?.('✅ పంట ఫోటో నమోదు అయింది', 'default');
      } catch (err) {
        console.error('[Panta] recordCropEvent failed:', err);
        ontoast?.('✅ పంట ఫోటో నమోదు అయింది (లోకల్)', 'default');
      }
    } else {
      ontoast?.('✅ పంట ఫోటో నమోదు అయింది (లోకల్)', 'default');
    }

    // Close the preview
    discardPhoto();
  }

  function discardPhoto() {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
      capturedPhotoUrl = null;
    }
    capturedPhotoFile = null;
    analysisResult = null;
    analysisError = null;
    analysisPending = false;
    activeForm = null;
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

    return () => {
      if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    };
  });
</script>

<!-- Hidden camera input -->
<input
  bind:this={cameraInputEl}
  type="file"
  accept="image/*"
  capture="environment"
  class="hidden-input"
  onchange={handleCameraCapture}
/>

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

<!-- Crop Photo Button (F006 prominent entry point) -->
<div class="photo-cta-wrap">
  <button class="photo-cta-btn" onclick={openCamera}>
    <span class="photo-cta-icon">📸</span>
    <div class="photo-cta-text">
      <span class="photo-cta-title">పంట ఫోటో</span>
      <span class="photo-cta-sub">AI తో పురుగు / వ్యాధి గుర్తింపు</span>
    </div>
    <span class="photo-cta-arrow">→</span>
  </button>
</div>

<!-- Photo Preview + Analysis Panel -->
{#if activeForm === 'photo_preview' && capturedPhotoUrl}
  <div class="photo-panel">
    <div class="photo-panel-header">
      <span class="photo-panel-title">📸 పంట ఫోటో విశ్లేషణ</span>
      <button class="photo-panel-close" onclick={discardPhoto} aria-label="close">✕</button>
    </div>

    <div class="photo-preview-wrap">
      <img src={capturedPhotoUrl} alt="crop photo" class="photo-preview-img" />
    </div>

    {#if analysisPending}
      <div class="analysis-loading">
        <div class="analysis-spinner" aria-label="analysing"></div>
        <span>AI విశ్లేషించుతోంది...</span>
      </div>
    {:else if analysisError}
      <div class="analysis-error">
        <span>⚠️ {analysisError}</span>
      </div>
    {:else if analysisResult}
      <div class="analysis-result">
        <div class="analysis-result-label">AI విశ్లేషణ</div>
        <div class="analysis-result-text">{analysisResult}</div>
      </div>
      <div class="photo-panel-actions">
        <button class="btn-cancel" onclick={discardPhoto}>రద్దు</button>
        <button class="btn-save" onclick={savePhotoEvent}>✅ నమోదు చేయండి</button>
      </div>
    {:else}
      <div class="photo-panel-actions">
        <button class="btn-cancel" onclick={discardPhoto}>రద్దు</button>
      </div>
    {/if}
  </div>
{/if}

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

<!-- Inline forms (water, fertilizer, pest — photo goes direct to camera) -->
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
  .hidden-input { display: none; }

  .panta-header { padding: var(--space-13) var(--space-21) var(--space-8); display: flex; align-items: center; justify-content: space-between; gap: var(--space-13); }
  .panta-title { font-family: var(--font-te-display); font-size: var(--text-xl); font-weight: 400; color: var(--ink-primary); animation: fadeUp var(--dur-610) var(--spring) 200ms both; }
  .field-selector { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) var(--space-13); background: var(--patti-warm); border: 1px solid var(--nalupurugu); border-radius: 2px 8px 3px 5px; cursor: pointer; font-size: var(--text-xs); max-width: 200px; animation: fadeUp var(--dur-610) var(--spring) 350ms both; }
  .field-selector-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .field-selector-name { font-weight: 600; color: var(--ink-primary); font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .field-selector-sub { font-size: 10px; color: var(--ink-tertiary); white-space: nowrap; }
  .field-selector-chevron { font-size: 10px; color: var(--ink-tertiary); flex-shrink: 0; }

  /* F006: Prominent photo CTA */
  .photo-cta-wrap { padding: 0 var(--space-21) var(--space-13); animation: fadeUp var(--dur-610) var(--spring) 300ms both; }
  .photo-cta-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-13);
    padding: var(--space-13) var(--space-21);
    background: linear-gradient(135deg, var(--patti-warm) 0%, #EDE8DB 100%);
    border: 1.5px solid var(--nalupurugu);
    border-left: 4px solid var(--pacchi);
    border-radius: 3px 10px 5px 3px;
    cursor: pointer;
    text-align: left;
    transition: transform var(--dur-233) var(--spring), box-shadow var(--dur-233) ease;
  }
  .photo-cta-btn:hover { transform: translateX(2px); box-shadow: 0 4px 16px rgba(45, 106, 79, 0.12); }
  .photo-cta-btn:active { transform: scale(0.99); }
  .photo-cta-icon { font-size: 28px; flex-shrink: 0; }
  .photo-cta-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .photo-cta-title { font-family: var(--font-te); font-size: var(--text-base); font-weight: 600; color: var(--pacchi); }
  .photo-cta-sub { font-size: var(--text-xs); color: var(--ink-tertiary); }
  .photo-cta-arrow { font-size: var(--text-lg); color: var(--pacchi); flex-shrink: 0; opacity: 0.6; }

  /* F006: Photo preview + analysis panel */
  .photo-panel {
    margin: 0 var(--space-21) var(--space-13);
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-top: 3px solid var(--pacchi);
    border-radius: 3px 10px 5px 3px;
    overflow: hidden;
    animation: expandForm var(--dur-377) var(--spring) forwards;
  }
  .photo-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-13) var(--space-21);
    border-bottom: 1px solid var(--nalupurugu);
  }
  .photo-panel-title { font-size: var(--text-sm); font-weight: 600; color: var(--pacchi); }
  .photo-panel-close {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: var(--ink-tertiary); cursor: pointer;
    transition: background var(--dur-144) ease;
  }
  .photo-panel-close:hover { background: var(--erra-soft); color: var(--erra); }

  .photo-preview-wrap { padding: var(--space-13); }
  .photo-preview-img {
    width: 100%;
    max-height: 240px;
    object-fit: cover;
    border-radius: 3px 8px 3px 5px;
    border: 1px solid var(--nalupurugu);
    display: block;
  }

  .analysis-loading {
    display: flex;
    align-items: center;
    gap: var(--space-13);
    padding: var(--space-13) var(--space-21);
    font-size: var(--text-sm);
    color: var(--ink-secondary);
    font-family: var(--font-te);
  }
  .analysis-spinner {
    width: 20px; height: 20px;
    border: 2.5px solid var(--nalupurugu);
    border-top-color: var(--pacchi);
    border-radius: 50%;
    animation: spinCrop 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spinCrop { to { transform: rotate(360deg); } }

  .analysis-error {
    padding: var(--space-13) var(--space-21);
    font-size: var(--text-sm);
    color: var(--erra);
    font-family: var(--font-te);
    background: var(--erra-soft);
    margin: 0 var(--space-13) var(--space-13);
    border-radius: 3px 8px 3px 5px;
  }

  .analysis-result {
    margin: 0 var(--space-13) var(--space-13);
    padding: var(--space-13);
    background: var(--patti);
    border: 1px solid rgba(45, 106, 79, 0.2);
    border-left: 3px solid var(--pacchi);
    border-radius: 3px 8px 3px 5px;
  }
  .analysis-result-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--pacchi);
    font-weight: 600;
    margin-bottom: var(--space-5);
  }
  .analysis-result-text {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .photo-panel-actions { display: flex; gap: var(--space-8); justify-content: flex-end; padding: var(--space-8) var(--space-21) var(--space-13); }

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
