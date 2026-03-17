<script lang="ts">
  import {
    loadConfig,
    saveConfig,
    hasApiKey,
    testSarvamKey,
    type SarvamConfig,
  } from '../lib/sarvam';
  import { loadOcrConfig, saveOcrConfig, hasOcrKey, type OcrConfig } from '../lib/ocr';
  import { loadSearchConfig, type SearchConfig } from '../lib/search';
  import { isTTSEnabled, setTTSEnabled } from '../lib/tts';
  import { getMandiApiKey, setMandiApiKey } from '../lib/mandi-api';
  import { generateSeasonReport, downloadPdf, type SeasonReport } from '../lib/pdf';
  import { getQueueSize } from '../lib/offline';
  import { showToast } from '../lib/toast';
  import {
    farmerMemories, dismissedMemories, refreshMemories,
    moneyEvents, cropEvents, balanceData, myFarmer,
  } from '../lib/stores';
  import {
    dismissMemory,
    restoreMemory,
    saveMemory,
  } from '../lib/memory';
  import { get } from 'svelte/store';

  interface Props {
    ontoast?: (message: string, type: string) => void;
  }

  let { ontoast }: Props = $props();

  // Load initial config
  let config: SarvamConfig = $state(loadConfig());
  let testing = $state(false);
  let keyStatus: 'unknown' | 'valid' | 'invalid' = $state(
    config.apiKey ? 'unknown' : 'invalid',
  );

  // OCR config
  let ocrConfig: OcrConfig = $state(loadOcrConfig());
  let ocrKeyStatus: 'present' | 'missing' = $state(
    hasOcrKey() ? 'present' : 'missing',
  );

  // Mandi API key (data.gov.in)
  let mandiApiKey = $state(getMandiApiKey());
  let mandiKeyStatus: 'present' | 'missing' | 'testing' | 'valid' | 'invalid' = $state(
    getMandiApiKey() ? 'present' : 'missing',
  );
  let showMandiKey = $state(false);

  // Search config (persisted state for UI toggles)
  const SEARCH_DDG_KEY   = 'rythu_mitra_search_ddg_enabled';
  const SEARCH_SARVAM_KEY = 'rythu_mitra_search_sarvam_enabled';
  const SEARCH_GOOGLE_KEY = 'rythu_mitra_search_api_key';
  const SEARCH_ENGINE_KEY = 'rythu_mitra_search_engine_id';

  let searchDDG    = $state(localStorage.getItem(SEARCH_DDG_KEY)    !== 'false');
  let searchSarvam = $state(localStorage.getItem(SEARCH_SARVAM_KEY) !== 'false');
  let searchGoogle = $state(!!(localStorage.getItem(SEARCH_GOOGLE_KEY)));
  let googleApiKey  = $state(localStorage.getItem(SEARCH_GOOGLE_KEY) ?? '');
  let googleEngineId = $state(localStorage.getItem(SEARCH_ENGINE_KEY) ?? '');

  function activeProviderCount(): number {
    let count = 1; // cached KB is always active
    if (searchDDG) count++;
    if (searchSarvam && hasApiKey()) count++;
    if (searchGoogle && googleApiKey && googleEngineId) count++;
    return count;
  }

  // PDF generation state
  let generatingPdf = $state(false);

  // Offline queue size
  let queueSize = $state(getQueueSize());

  // TTS toggle state (reads from localStorage via helper)
  let ttsEnabled = $state(isTTSEnabled());

  function handleTtsToggle() {
    ttsEnabled = !ttsEnabled;
    setTTSEnabled(ttsEnabled);
  }

  // Memory section state
  let showDismissed = $state(false);
  let showAddMemory = $state(false);
  let newMemoryText = $state('');

  // Mask API key for display
  function maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  function handleKeyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    config.apiKey = input.value.trim();
    keyStatus = config.apiKey ? 'unknown' : 'invalid';
  }

  function handleSave() {
    saveConfig(config);
    // Save OCR config
    saveOcrConfig(ocrConfig);
    ocrKeyStatus = ocrConfig.mistralApiKey ? 'present' : 'missing';
    // Save mandi API key
    setMandiApiKey(mandiApiKey);
    mandiKeyStatus = mandiApiKey ? 'present' : 'missing';
    // Save search config toggles
    localStorage.setItem(SEARCH_DDG_KEY,    String(searchDDG));
    localStorage.setItem(SEARCH_SARVAM_KEY, String(searchSarvam));
    if (googleApiKey)   localStorage.setItem(SEARCH_GOOGLE_KEY, googleApiKey);
    else                localStorage.removeItem(SEARCH_GOOGLE_KEY);
    if (googleEngineId) localStorage.setItem(SEARCH_ENGINE_KEY, googleEngineId);
    else                localStorage.removeItem(SEARCH_ENGINE_KEY);
    queueSize = getQueueSize();
    showToast('Settings saved', 'default', 2000);
  }

  function handleOcrKeyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    ocrConfig.mistralApiKey = input.value.trim();
    ocrKeyStatus = ocrConfig.mistralApiKey ? 'present' : 'missing';
  }

  function handleTestOcrKey() {
    if (!ocrConfig.mistralApiKey) {
      showToast('Mistral OCR key not entered', 'warning', 3000);
      return;
    }
    // Key format validation: must be a non-empty string (real validation requires a network call)
    if (ocrConfig.mistralApiKey.length >= 8) {
      ocrKeyStatus = 'present';
      showToast('OCR key looks valid! Save to apply.', 'default', 3000);
    } else {
      showToast('Key too short — check and try again', 'alert', 3000);
    }
  }

  function handleMandiKeyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    mandiApiKey = input.value.trim();
    mandiKeyStatus = mandiApiKey ? 'present' : 'missing';
  }

  async function handleTestMandiKey() {
    if (!mandiApiKey) {
      showToast('data.gov.in API కీ లేదు', 'warning', 3000);
      return;
    }
    mandiKeyStatus = 'testing';
    try {
      const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
      const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${mandiApiKey}&format=json&limit=1&offset=0`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        const total = data.total || 0;
        mandiKeyStatus = 'valid';
        showToast(`API కీ సరైనది! ${total.toLocaleString('en-IN')} రికార్డులు అందుబాటులో ఉన్నాయి`, 'default', 4000);
      } else {
        mandiKeyStatus = 'invalid';
        showToast(`API కీ తప్పు: HTTP ${res.status}`, 'alert', 4000);
      }
    } catch (err) {
      mandiKeyStatus = 'invalid';
      showToast('నెట్‌వర్క్ లోపం — మళ్ళీ ప్రయత్నించండి', 'warning', 3000);
    }
  }

  async function handleDownloadPdf() {
    generatingPdf = true;
    try {
      const farmer = get(myFarmer);
      const events = get(moneyEvents);
      const crops  = get(cropEvents);
      const bal    = get(balanceData);

      // Compute top expense category
      const expenseByKind = new Map<string, number>();
      for (const e of events) {
        if (e.amount < 0) {
          expenseByKind.set(e.kind, (expenseByKind.get(e.kind) ?? 0) + Math.abs(e.amount));
        }
      }
      let topKind = 'labor';
      let topAmt  = 0;
      for (const [k, a] of expenseByKind) {
        if (a > topAmt) { topAmt = a; topKind = k; }
      }
      const topPct = bal.expense > 0 ? Math.round((topAmt / bal.expense) * 100) : 0;

      const report: SeasonReport = {
        farmerName:  farmer?.name ?? 'రైతు',
        village:     farmer?.village ?? '',
        district:    farmer?.district ?? '',
        season:      'రబీ 2026',
        totalIncome:   bal.income,
        totalExpense:  bal.expense,
        balance:       bal.net,
        transactions:  events.map(e => ({
          date:        e.date,
          description: e.description,
          amount:      e.amount,
          kind:        e.kind,
        })),
        topExpenseCategory: topKind,
        topExpensePercent:  topPct,
        cropEvents: crops.map(c => ({
          date:  c.date,
          kind:  c.kind,
          crop:  c.title,
          notes: c.body,
        })),
      };

      const bytes = await generateSeasonReport(report);
      downloadPdf(bytes, `season_report_rabi2026.pdf`);
      showToast('PDF డౌన్లోడ్ మొదలైంది', 'default', 2000);
    } catch (err) {
      showToast('PDF తయారు చేయడం సాధ్యం కాలేదు', 'alert', 3000);
      console.error('PDF generation error:', err);
    } finally {
      generatingPdf = false;
    }
  }

  function handleClearData() {
    const confirmed = window.confirm(
      'మీ అన్ని స్థానిక డేటా తొలగించబడుతుంది. ఖచ్చితంగా కొనసాగించాలా?'
    );
    if (!confirmed) return;
    localStorage.clear();
    showToast('స్థానిక డేటా క్లియర్ చేయబడింది. పేజీ రిఫ్రెష్ చేయండి.', 'default', 4000);
  }

  async function handleTestKey() {
    if (!config.apiKey) {
      showToast('Sarvam API key not entered', 'warning', 3000);
      return;
    }

    testing = true;
    try {
      const valid = await testSarvamKey(config.apiKey);
      keyStatus = valid ? 'valid' : 'invalid';
      if (valid) {
        showToast('Sarvam key is valid! STT + Chat ready', 'default', 3000);
      } else {
        showToast('Sarvam key is invalid', 'alert', 3000);
      }
    } catch {
      keyStatus = 'invalid';
      showToast('Could not test key - check network', 'warning', 3000);
    } finally {
      testing = false;
    }
  }

  function handleDismissMemory(id: number) {
    dismissMemory(id);
    refreshMemories();
    showToast('జ్ఞాపకం తొలగించబడింది', 'default', 2000);
  }

  function handleRestoreMemory(id: number) {
    restoreMemory(id);
    refreshMemories();
    showToast('జ్ఞాపకం పునరుద్ధరించబడింది', 'default', 2000);
  }

  function handleAddMemory() {
    const text = newMemoryText.trim();
    if (!text) {
      showToast('జ్ఞాపకం ఖాళీగా ఉంది', 'warning', 2000);
      return;
    }
    saveMemory(text, 'farmer_stated', 0.95);
    refreshMemories();
    newMemoryText = '';
    showAddMemory = false;
    showToast('జ్ఞాపకం జోడించబడింది', 'default', 2000);
  }

  function memorySourceLabel(source: string): string {
    switch (source) {
      case 'ai_observed': return '🤖 AI గమనించింది';
      case 'farmer_stated': return '👩‍🌾 మీరు చెప్పారు';
      case 'pattern_detected': return '📊 నమూనా';
      default: return source;
    }
  }
</script>

<div class="settings-screen">
  <header class="settings-header">
    <h1 class="settings-title">Settings</h1>
    <p class="settings-subtitle">AI API Configuration</p>
  </header>

  <!-- Sarvam API Key (one key for everything) -->
  <section class="config-section">
    <div class="field-header">
      <label class="field-label" for="sarvam-key">Sarvam API Key</label>
      <span
        class="status-dot"
        class:valid={keyStatus === 'valid'}
        class:invalid={keyStatus === 'invalid'}
        class:unknown={keyStatus === 'unknown'}
        aria-label={keyStatus === 'valid'
          ? 'configured'
          : keyStatus === 'invalid'
            ? 'not configured'
            : 'not tested'}
      ></span>
    </div>
    <p class="field-hint">One key for STT, Chat, TTS, Translate (api.sarvam.ai)</p>
    <input
      id="sarvam-key"
      type="password"
      class="key-input"
      placeholder="sk_..."
      value={config.apiKey}
      oninput={handleKeyInput}
      autocomplete="off"
      spellcheck={false}
    />
    <button
      class="test-btn"
      onclick={handleTestKey}
      disabled={testing || !config.apiKey}
    >
      {#if testing}
        Testing...
      {:else}
        Test Key
      {/if}
    </button>
  </section>

  <!-- Chat Model selector -->
  <section class="config-section">
    <label class="field-label" for="chat-model">Chat Model</label>
    <p class="field-hint">sarvam-105b (powerful) or sarvam-m (fast)</p>
    <select
      id="chat-model"
      class="key-input select-input"
      value={config.chatModel}
      onchange={(e) => {
        config.chatModel = (e.target as HTMLSelectElement).value;
      }}
    >
      <option value="sarvam-105b">sarvam-105b (recommended)</option>
      <option value="sarvam-m">sarvam-m (fast, 24B)</option>
    </select>
  </section>

  <!-- TTS Toggle -->
  <section class="config-section">
    <div class="tts-toggle-row">
      <div class="tts-toggle-info">
        <span class="field-label">ధ్వని నిర్ధారణ</span>
        <p class="field-hint">ఖర్చు నమోదు తర్వాత తెలుగులో చదువుతుంది</p>
      </div>
      <button
        class="tts-toggle-btn"
        class:on={ttsEnabled}
        onclick={handleTtsToggle}
        aria-label="ధ్వని నిర్ధారణ {ttsEnabled ? 'ఆపు' : 'ప్రారంభించు'}"
        type="button"
      >
        <span class="tts-toggle-label">{ttsEnabled ? 'ఆన్' : 'ఆఫ్'}</span>
        <span class="tts-toggle-icon">{ttsEnabled ? '🔊' : '🔇'}</span>
      </button>
    </div>
  </section>

  <!-- Mistral OCR Key -->
  <section class="config-section">
    <div class="field-header">
      <label class="field-label" for="mistral-key">Mistral OCR Key</label>
      <span
        class="status-dot"
        class:valid={ocrKeyStatus === 'present'}
        class:invalid={ocrKeyStatus === 'missing'}
        aria-label={ocrKeyStatus === 'present' ? 'configured' : 'not configured'}
      ></span>
    </div>
    <p class="field-hint">For bill/document scanning (api.mistral.ai)</p>
    <input
      id="mistral-key"
      type="password"
      class="key-input"
      placeholder="Enter Mistral API key..."
      value={ocrConfig.mistralApiKey}
      oninput={handleOcrKeyInput}
      autocomplete="off"
      spellcheck={false}
    />
    <button
      class="test-btn"
      onclick={handleTestOcrKey}
      disabled={!ocrConfig.mistralApiKey}
    >
      Test Key
    </button>
  </section>

  <!-- data.gov.in Mandi API Key -->
  <section class="config-section">
    <div class="field-header">
      <label class="field-label" for="mandi-key">మండీ ధరల API కీ (data.gov.in)</label>
      <span
        class="status-dot"
        class:valid={mandiKeyStatus === 'valid' || mandiKeyStatus === 'present'}
        class:invalid={mandiKeyStatus === 'missing' || mandiKeyStatus === 'invalid'}
        class:unknown={mandiKeyStatus === 'testing'}
        aria-label={mandiKeyStatus === 'valid' || mandiKeyStatus === 'present'
          ? 'configured'
          : mandiKeyStatus === 'testing'
            ? 'testing'
            : 'not configured'}
      ></span>
    </div>
    <p class="field-hint">
      data.gov.in నుండి ఉచిత API కీ పొందండి — నేటి మండీ ధరలకు అవసరం
    </p>
    <div class="key-input-row">
      <input
        id="mandi-key"
        type={showMandiKey ? 'text' : 'password'}
        class="key-input"
        placeholder="Enter data.gov.in API key..."
        value={mandiApiKey}
        oninput={handleMandiKeyInput}
        autocomplete="off"
        spellcheck={false}
      />
      <button
        class="show-hide-btn"
        type="button"
        onclick={() => { showMandiKey = !showMandiKey; }}
        aria-label={showMandiKey ? 'కీ దాచు' : 'కీ చూపు'}
      >{showMandiKey ? '🙈' : '👁'}</button>
    </div>
    <div class="btn-row">
      <button
        class="test-btn"
        onclick={handleTestMandiKey}
        disabled={mandiKeyStatus === 'testing' || !mandiApiKey}
      >
        {#if mandiKeyStatus === 'testing'}
          పరీక్షిస్తోంది...
        {:else}
          కీ పరీక్షించు
        {/if}
      </button>
      {#if mandiKeyStatus === 'valid'}
        <span class="key-ok-badge">సరైనది</span>
      {:else if mandiKeyStatus === 'invalid'}
        <span class="key-fail-badge">తప్పు</span>
      {/if}
    </div>
    <p class="mandi-key-help">
      API కీ పొందడానికి:
      <a
        href="https://data.gov.in/user/register"
        target="_blank"
        rel="noopener noreferrer"
        class="mandi-link"
      >data.gov.in లో రిజిస్టర్ చేయండి</a>
    </p>
  </section>

  <!-- Search Configuration -->
  <section class="config-section">
    <p class="field-label" role="group" aria-label="Web Search">Web Search</p>
    <p class="field-hint">Select providers for AI web search queries</p>

    <div class="search-option">
      <label class="checkbox-label">
        <input
          type="checkbox"
          bind:checked={searchDDG}
          class="checkbox-input"
        />
        <span class="checkbox-text">DuckDuckGo (free, no key needed)</span>
      </label>
    </div>

    <div class="search-option">
      <label class="checkbox-label">
        <input
          type="checkbox"
          bind:checked={searchSarvam}
          class="checkbox-input"
        />
        <span class="checkbox-text">Sarvam Knowledge (uses main Sarvam key)</span>
      </label>
    </div>

    <div class="search-option">
      <label class="checkbox-label">
        <input
          type="checkbox"
          bind:checked={searchGoogle}
          class="checkbox-input"
        />
        <span class="checkbox-text">Google Custom Search</span>
      </label>
    </div>

    {#if searchGoogle}
      <div class="google-fields">
        <input
          type="password"
          class="key-input"
          style="margin-bottom: var(--space-8);"
          placeholder="Google API Key"
          bind:value={googleApiKey}
          autocomplete="off"
        />
        <input
          type="text"
          class="key-input"
          placeholder="Google Engine ID (cx=...)"
          bind:value={googleEngineId}
          autocomplete="off"
        />
      </div>
    {/if}
  </section>

  <!-- Save button -->
  <button class="save-btn" onclick={handleSave}>
    Save Settings
  </button>

  <!-- Status summary -->
  <div class="status-summary">
    <div class="status-row">
      <span class="status-label">STT (Speech-to-Text):</span>
      <span class="status-value" class:ok={hasApiKey()} class:missing={!hasApiKey()}>
        {hasApiKey() ? 'Ready' : 'Key needed'}
      </span>
    </div>
    <div class="status-row">
      <span class="status-label">Chat (AI):</span>
      <span class="status-value" class:ok={hasApiKey()} class:missing={!hasApiKey()}>
        {hasApiKey() ? 'Ready' : 'Key needed'}
      </span>
    </div>
    <div class="status-row">
      <span class="status-label">TTS (Voice):</span>
      <span class="status-value" class:ok={hasApiKey()} class:missing={!hasApiKey()}>
        {hasApiKey() ? 'Ready' : 'Key needed'}
      </span>
    </div>
    <div class="status-row">
      <span class="status-label">OCR (Bill Scan):</span>
      <span class="status-value" class:ok={ocrKeyStatus === 'present'} class:missing={ocrKeyStatus === 'missing'}>
        {ocrKeyStatus === 'present' ? 'Ready' : 'Key needed'}
      </span>
    </div>
    <div class="status-row">
      <span class="status-label">Web Search:</span>
      <span class="status-value ok">
        {activeProviderCount()} providers active
      </span>
    </div>
    <div class="status-row">
      <span class="status-label">PDF Reports:</span>
      <span class="status-value ok">Ready</span>
    </div>
    <div class="status-row">
      <span class="status-label">మండీ ధరలు:</span>
      <span
        class="status-value"
        class:ok={mandiKeyStatus === 'valid' || mandiKeyStatus === 'present'}
        class:missing={mandiKeyStatus === 'missing' || mandiKeyStatus === 'invalid'}
      >
        {mandiKeyStatus === 'valid' || mandiKeyStatus === 'present' ? 'Ready' : 'Key needed'}
      </span>
    </div>
    {#if queueSize > 0}
    <div class="status-row">
      <span class="status-label">Offline queue:</span>
      <span class="status-value" class:ok={queueSize === 0} class:missing={queueSize > 0}>
        {queueSize} pending
      </span>
    </div>
    {/if}
  </div>

  <!-- Data Export Section -->
  <section class="data-export-section">
    <h2 class="data-export-title">డేటా ఎగుమతి</h2>
    <div class="export-buttons">
      <button
        class="export-btn pdf-btn"
        onclick={handleDownloadPdf}
        disabled={generatingPdf}
      >
        {#if generatingPdf}
          <span class="export-btn-icon">⏳</span>
          <span class="export-btn-label">తయారవుతోంది...</span>
        {:else}
          <span class="export-btn-icon">📄</span>
          <span class="export-btn-label">సీజన్ సారాంశం PDF</span>
        {/if}
      </button>
      <button
        class="export-btn clear-btn"
        onclick={handleClearData}
      >
        <span class="export-btn-icon">🗑️</span>
        <span class="export-btn-label">డేటా క్లియర్</span>
      </button>
    </div>
  </section>

  <!-- ═══ Memories Section ═══ -->
  <section class="memories-section">
    <div class="memories-header">
      <h2 class="memories-title">💭 నా జ్ఞాపకాలు</h2>
      <span class="memory-count">{$farmerMemories.length} active</span>
    </div>

    {#if $farmerMemories.length === 0}
      <p class="memories-empty">ఇంకా జ్ఞాపకాలు లేవు. చాట్‌లో మాట్లాడినప్పుడు AI గుర్తుంచుకుంటుంది.</p>
    {:else}
      <div class="memory-list">
        {#each $farmerMemories as memory (memory.id)}
          <div class="memory-card">
            <div class="memory-content">{memory.content}</div>
            <div class="memory-meta">
              <span class="memory-source">{memorySourceLabel(memory.source)}</span>
              <button
                class="memory-dismiss-btn"
                onclick={() => handleDismissMemory(memory.id)}
                aria-label="తొలగించు"
              >
                ✕
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Add Memory -->
    {#if showAddMemory}
      <div class="add-memory-form">
        <textarea
          class="memory-textarea"
          placeholder="ఉదా: నేను డ్రిప్ ఇరిగేషన్ ప్రయత్నించాలనుకుంటున్నాను..."
          bind:value={newMemoryText}
          rows={3}
        ></textarea>
        <div class="add-memory-actions">
          <button class="add-memory-cancel" onclick={() => { showAddMemory = false; newMemoryText = ''; }}>
            రద్దు
          </button>
          <button class="add-memory-save" onclick={handleAddMemory}>
            సేవ్ చేయి
          </button>
        </div>
      </div>
    {:else}
      <button class="add-memory-btn" onclick={() => { showAddMemory = true; }}>
        + జ్ఞాపకం జోడించు
      </button>
    {/if}

    <!-- Dismissed Memories (collapsed) -->
    {#if $dismissedMemories.length > 0}
      <button
        class="dismissed-toggle"
        onclick={() => { showDismissed = !showDismissed; }}
      >
        {showDismissed ? '▾' : '▸'} తొలగించినవి ({$dismissedMemories.length})
      </button>

      {#if showDismissed}
        <div class="memory-list dismissed">
          {#each $dismissedMemories as memory (memory.id)}
            <div class="memory-card dismissed-card">
              <div class="memory-content dimmed">{memory.content}</div>
              <div class="memory-meta">
                <span class="memory-source">{memorySourceLabel(memory.source)}</span>
                <button
                  class="memory-restore-btn"
                  onclick={() => handleRestoreMemory(memory.id)}
                  aria-label="పునరుద్ధరించు"
                >
                  ↩
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </section>
</div>

<div class="bottom-spacer"></div>

<style>
  .settings-screen {
    padding: var(--space-21) var(--space-13);
    max-width: 420px;
    margin: 0 auto;
  }

  .settings-header {
    margin-bottom: var(--space-34);
    padding-top: var(--space-34);
  }

  .settings-title {
    font-family: var(--font-te-display);
    font-size: var(--text-2xl);
    color: var(--ink-primary);
    font-weight: 600;
    margin-bottom: var(--space-5);
  }

  .settings-subtitle {
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
  }

  /* TTS toggle */
  .tts-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-13);
  }
  .tts-toggle-info {
    flex: 1;
    min-width: 0;
  }
  .tts-toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-5) var(--space-13);
    border-radius: 20px;
    border: 1.5px solid var(--nalupurugu);
    background: var(--patti);
    color: var(--ink-tertiary);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--dur-233) ease, border-color var(--dur-233) ease, color var(--dur-233) ease;
    white-space: nowrap;
    min-height: 40px;
  }
  .tts-toggle-btn.on {
    background: var(--pacchi-glow, rgba(45, 106, 79, 0.12));
    border-color: var(--pacchi);
    color: var(--pacchi);
  }
  .tts-toggle-btn:active {
    transform: scale(0.95);
  }
  .tts-toggle-label {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .tts-toggle-icon {
    font-size: 16px;
    line-height: 1;
  }

  .config-section {
    background: var(--patti-warm);
    border-radius: var(--radius-card);
    padding: var(--space-13);
    margin-bottom: var(--space-13);
    border: 1px solid var(--nalupurugu-soft);
  }

  .field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .field-label {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-primary);
    display: block;
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    margin-bottom: var(--space-8);
  }

  .key-input {
    width: 100%;
    padding: var(--space-8) var(--space-13);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card-sm);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    background: var(--patti);
    outline: none;
    transition: border-color var(--dur-233) ease;
  }

  .key-input:focus {
    border-color: var(--pasupu);
  }

  .select-input {
    font-family: var(--font-te);
    cursor: pointer;
    appearance: auto;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background var(--dur-233) ease;
  }

  .status-dot.valid {
    background: var(--pacchi);
    box-shadow: 0 0 4px var(--pacchi-glow);
  }

  .status-dot.invalid {
    background: var(--erra);
  }

  .status-dot.unknown {
    background: var(--pasupu);
  }

  .test-btn {
    margin-top: var(--space-8);
    padding: var(--space-5) var(--space-13);
    background: var(--neeli);
    color: var(--ink-on-dark);
    border-radius: var(--radius-card-sm);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    font-weight: 600;
    min-height: 36px;
    cursor: pointer;
    transition: opacity var(--dur-233) ease;
  }

  .test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .save-btn {
    width: 100%;
    padding: var(--space-13);
    background: var(--pacchi);
    color: var(--patti);
    border-radius: var(--radius-card);
    font-family: var(--font-te);
    font-size: var(--text-base);
    font-weight: 600;
    min-height: 48px;
    margin-top: var(--space-8);
    transition: transform var(--dur-233) var(--spring), box-shadow var(--dur-233) ease;
    box-shadow: 0 2px 8px rgba(45, 106, 79, 0.3);
    cursor: pointer;
  }

  .save-btn:active {
    transform: scale(0.97);
  }

  .save-btn:hover {
    box-shadow: 0 4px 13px rgba(45, 106, 79, 0.4);
    transform: translateY(-1px);
  }

  .status-summary {
    margin-top: var(--space-21);
    padding: var(--space-13);
    background: var(--patti-warm);
    border-radius: var(--radius-card);
    border: 1px solid var(--nalupurugu-soft);
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-5) 0;
  }

  .status-row + .status-row {
    border-top: 1px solid var(--nalupurugu-soft);
  }

  .status-label {
    font-size: var(--text-sm);
    color: var(--ink-secondary);
  }

  .status-value {
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .status-value.ok {
    color: var(--pacchi);
  }

  .status-value.missing {
    color: var(--erra);
  }

  /* ═══ Memories Section ═══ */

  .memories-section {
    margin-top: var(--space-34);
  }

  .memories-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--space-13);
  }

  .memories-title {
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink-primary);
  }

  .memory-count {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    font-family: var(--font-mono);
  }

  .memories-empty {
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
    padding: var(--space-13);
    text-align: center;
    background: var(--patti-warm);
    border-radius: var(--radius-card);
    border: 1px dashed var(--nalupurugu);
  }

  .memory-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .memory-card {
    background: var(--patti-warm);
    border-radius: var(--radius-card);
    padding: var(--space-13);
    border: 1px solid var(--nalupurugu-soft);
    border-left: 3px solid var(--pacchi);
  }

  .dismissed-card {
    border-left-color: var(--nalupurugu);
    opacity: 0.7;
  }

  .memory-content {
    font-size: var(--text-sm);
    color: var(--ink-primary);
    line-height: 1.5;
    margin-bottom: var(--space-5);
  }

  .memory-content.dimmed {
    color: var(--ink-tertiary);
    text-decoration: line-through;
  }

  .memory-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .memory-source {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
  }

  .memory-dismiss-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--erra-soft);
    color: var(--erra);
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--dur-233) ease;
    border: none;
  }

  .memory-dismiss-btn:hover {
    background: var(--erra);
    color: var(--patti);
  }

  .memory-restore-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--pacchi-glow);
    color: var(--pacchi);
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--dur-233) ease;
    border: none;
  }

  .memory-restore-btn:hover {
    background: var(--pacchi);
    color: var(--patti);
  }

  .add-memory-btn {
    width: 100%;
    margin-top: var(--space-13);
    padding: var(--space-8) var(--space-13);
    background: var(--pacchi-glow);
    color: var(--pacchi);
    border: 1px dashed var(--pacchi);
    border-radius: var(--radius-card);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--dur-233) ease;
  }

  .add-memory-btn:hover {
    background: var(--pacchi);
    color: var(--patti);
  }

  .add-memory-form {
    margin-top: var(--space-13);
    background: var(--patti-warm);
    border-radius: var(--radius-card);
    padding: var(--space-13);
    border: 1px solid var(--pacchi);
  }

  .memory-textarea {
    width: 100%;
    padding: var(--space-8);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card-sm);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    background: var(--patti);
    outline: none;
    resize: vertical;
    min-height: 60px;
  }

  .memory-textarea:focus {
    border-color: var(--pacchi);
  }

  .add-memory-actions {
    display: flex;
    gap: var(--space-8);
    justify-content: flex-end;
    margin-top: var(--space-8);
  }

  .add-memory-cancel {
    padding: var(--space-5) var(--space-13);
    background: transparent;
    color: var(--ink-tertiary);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card-sm);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .add-memory-save {
    padding: var(--space-5) var(--space-13);
    background: var(--pacchi);
    color: var(--patti);
    border-radius: var(--radius-card-sm);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
  }

  .dismissed-toggle {
    display: block;
    width: 100%;
    margin-top: var(--space-13);
    padding: var(--space-5);
    background: transparent;
    color: var(--ink-tertiary);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    cursor: pointer;
    text-align: left;
    border: none;
  }

  .dismissed-toggle:hover {
    color: var(--ink-secondary);
  }

  .memory-list.dismissed {
    margin-top: var(--space-8);
  }

  /* Search config checkboxes */
  .search-option {
    margin-bottom: var(--space-8);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    cursor: pointer;
  }

  .checkbox-input {
    width: 16px;
    height: 16px;
    accent-color: var(--pacchi);
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-text {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-secondary);
  }

  .google-fields {
    margin-top: var(--space-8);
    padding-left: var(--space-21);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  /* ── Mandi API Key input row ── */
  .key-input-row {
    display: flex;
    gap: var(--space-5);
    align-items: center;
    margin-bottom: var(--space-8);
  }
  .key-input-row .key-input {
    flex: 1;
    margin-bottom: 0;
  }
  .show-hide-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-card-sm);
    border: 1px solid var(--nalupurugu);
    background: var(--patti);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--dur-233) ease;
  }
  .show-hide-btn:hover {
    background: var(--nalupurugu);
  }
  .btn-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }
  .key-ok-badge {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--pacchi);
    background: var(--pacchi-soft);
    padding: 2px var(--space-8);
    border-radius: 4px;
  }
  .key-fail-badge {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--erra);
    background: var(--erra-soft);
    padding: 2px var(--space-8);
    border-radius: 4px;
  }
  .mandi-key-help {
    margin-top: var(--space-8);
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
  }
  .mandi-link {
    color: var(--neeli);
    text-decoration: underline;
  }
  .mandi-link:hover {
    color: var(--neeli);
    opacity: 0.8;
  }

  /* Data Export Section */
  .data-export-section {
    margin-top: var(--space-34);
    padding: var(--space-21) 0;
    border-top: 1px solid var(--nalupurugu-soft);
  }

  .data-export-title {
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink-primary);
    margin-bottom: var(--space-13);
  }

  .export-buttons {
    display: flex;
    gap: var(--space-8);
  }

  .export-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-13) var(--space-8);
    border-radius: var(--radius-card);
    border: 1px solid var(--nalupurugu);
    cursor: pointer;
    transition: transform var(--dur-233) var(--spring), box-shadow var(--dur-233) ease;
    min-height: 72px;
  }

  .export-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .pdf-btn {
    background: var(--neeli-soft, rgba(27, 79, 114, 0.06));
    border-color: var(--neeli);
  }

  .clear-btn {
    background: var(--erra-soft);
    border-color: var(--erra);
  }

  .export-btn-icon {
    font-size: 20px;
    line-height: 1;
  }

  .export-btn-label {
    font-family: var(--font-te);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-secondary);
    text-align: center;
    line-height: 1.3;
  }
</style>
