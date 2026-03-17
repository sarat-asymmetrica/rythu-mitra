<script lang="ts">
  import {
    loadConfig,
    saveConfig,
    hasApiKey,
    testSarvamKey,
    type SarvamConfig,
  } from '../lib/sarvam';
  import { showToast } from '../lib/toast';
  import { farmerMemories, dismissedMemories, refreshMemories } from '../lib/stores';
  import {
    dismissMemory,
    restoreMemory,
    saveMemory,
  } from '../lib/memory';

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
    showToast('Settings saved', 'default', 2000);
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
  </div>

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
</style>
