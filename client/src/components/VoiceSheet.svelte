<script lang="ts">
  import { onMount } from 'svelte';
  import ParsedExpenseCard from './ParsedExpenseCard.svelte';
  import {
    type ParsedExpense,
    type VoiceState,
    startRecording,
    stopRecording,
    audioToBase64,
    parseTeluguExpense,
    getMockTranscription,
  } from '../lib/voice';
  import { connected } from '../lib/stores';
  import { hasApiKey, transcribeAudio, extractIntent } from '../lib/sarvam';
  import { showToast } from '../lib/toast';

  interface Props {
    open: boolean;
    onclose: () => void;
    onsave: (expense: ParsedExpense) => void;
  }

  let { open, onclose, onsave }: Props = $props();

  let voiceState: VoiceState = $state('idle');
  let parsedExpense: ParsedExpense | null = $state(null);
  let editing = $state(false);
  let statusText = $state('');
  let waveformCanvas: HTMLCanvasElement | null = $state(null);
  let waveformRAF: number | null = null;
  let waveformTime = 0;
  let recordingTimeout: ReturnType<typeof setTimeout> | null = null;

  // Status text in Telugu for each state
  const STATUS_TEXTS: Record<VoiceState, string> = {
    idle: '',
    recording: 'వింటున్నాను...',
    transcribing: 'అర్థం చేసుకుంటున్నాను...',
    parsed: 'ఇది సరైనదా?',
    confirming: 'సేవ్ చేస్తున్నాను...',
    editing: 'మార్చండి',
    saving: 'సేవ్ చేస్తున్నాను...',
    saved: 'సేవ్ అయింది!',
  };

  // React to open/close
  $effect(() => {
    if (open && voiceState === 'idle') {
      beginRecording();
    } else if (!open) {
      cleanup();
    }
  });

  async function beginRecording() {
    voiceState = 'recording';
    statusText = STATUS_TEXTS.recording;
    editing = false;
    parsedExpense = null;

    try {
      await startRecording();
    } catch {
      // Mic permission denied or not available - go to mock mode
      console.warn('[voice] Microphone not available, using mock mode');
    }

    startWaveform();

    // Auto-stop after 5 seconds for demo (in real app, user taps to stop)
    recordingTimeout = setTimeout(() => {
      finishRecording();
    }, 5000);
  }

  async function finishRecording() {
    if (voiceState !== 'recording') return;
    voiceState = 'transcribing';
    statusText = STATUS_TEXTS.transcribing;
    stopWaveform();

    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }

    let transcribedText: string;
    let audioBlob: Blob | null = null;

    // Always stop the recorder to get the audio blob + release mic
    try {
      audioBlob = await stopRecording();
    } catch {
      // May not have started recording (mic denied)
    }

    // Try Sarvam STT if API key is configured
    if (hasApiKey() && audioBlob && audioBlob.size > 0) {
      try {
        const result = await transcribeAudio(audioBlob);
        transcribedText = result.transcript;
        if (!transcribedText || transcribedText.trim().length === 0) {
          // Empty transcript — probably silence, fall back to mock
          transcribedText = getMockTranscription();
          showToast('Audio not recognized, showing demo', 'warning', 3000);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'STT failed';
        showToast(msg, 'warning', 4000);
        transcribedText = getMockTranscription();
      }
    } else {
      // No API key or no audio — mock mode
      if (!hasApiKey()) {
        showToast('API key needed - go to Settings', 'warning', 4000);
      }
      transcribedText = getMockTranscription();
    }

    // Parse the Telugu text with local parser
    let parsed = parseTeluguExpense(transcribedText);

    // If local parser confidence is low, try AI-assisted extraction
    if (parsed.confidence < 0.7) {
      parsed = await extractIntent(transcribedText, parsed);
    }

    parsedExpense = parsed;
    voiceState = 'parsed';
    statusText = STATUS_TEXTS.parsed;
  }

  function handleConfirm() {
    if (!parsedExpense) return;
    voiceState = 'saving';
    statusText = STATUS_TEXTS.saving;

    // Small delay for visual feedback, then save
    setTimeout(() => {
      if (parsedExpense) {
        onsave(parsedExpense);
      }
      voiceState = 'saved';
      statusText = STATUS_TEXTS.saved;

      // Auto-close after save animation
      setTimeout(() => {
        handleClose();
      }, 610);
    }, 233);
  }

  function handleEdit() {
    editing = true;
    voiceState = 'editing';
    statusText = STATUS_TEXTS.editing;
  }

  function handleEditField(field: string, value: string | number) {
    if (!parsedExpense) return;
    if (field === 'amount_paise') {
      parsedExpense = { ...parsedExpense, amount_paise: value as number };
    } else if (field === 'kind') {
      parsedExpense = { ...parsedExpense, kind: value as ParsedExpense['kind'] };
    }
  }

  function handleEditDone() {
    editing = false;
    voiceState = 'parsed';
    statusText = STATUS_TEXTS.parsed;
  }

  function handleClose() {
    cleanup();
    onclose();
  }

  function handleOverlayClick() {
    handleClose();
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  function cleanup() {
    stopWaveform();
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }
    voiceState = 'idle';
    editing = false;
    parsedExpense = null;
    statusText = '';
  }

  // --- Waveform Drawing ---

  function startWaveform() {
    if (!waveformCanvas) return;

    const canvas = waveformCanvas;
    canvas.width = canvas.offsetWidth || 330;
    canvas.height = canvas.offsetHeight || 55;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = H / 2;

    const waves = [
      { freq: 0.045, amp: cx * 0.55, phase: 0, speed: 2.1, alpha: 0.7 },
      { freq: 0.030, amp: cx * 0.35, phase: Math.PI, speed: 1.4, alpha: 0.45 },
      { freq: 0.070, amp: cx * 0.25, phase: Math.PI / 2, speed: 3.0, alpha: 0.3 },
    ];

    function drawFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      waveformTime += 0.04;

      for (const wave of waves) {
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const y = cx + Math.sin(x * wave.freq + waveformTime * wave.speed + wave.phase) * wave.amp;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = `rgba(232, 163, 23, ${wave.alpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      waveformRAF = requestAnimationFrame(drawFrame);
    }

    stopWaveform();
    drawFrame();
  }

  function stopWaveform() {
    if (waveformRAF !== null) {
      cancelAnimationFrame(waveformRAF);
      waveformRAF = null;
    }
    if (waveformCanvas) {
      const ctx = waveformCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
      }
    }
  }

  onMount(() => {
    return () => {
      cleanup();
    };
  });
</script>

{#if open}
  <!-- Overlay -->
  <div
    class="voice-overlay"
    onclick={handleOverlayClick}
    onkeydown={handleOverlayKeydown}
    role="button"
    tabindex="-1"
    aria-label="close voice sheet"
  ></div>

  <!-- Bottom sheet -->
  <div
    class="voice-sheet"
    role="dialog"
    aria-modal="true"
    aria-label="voice expense entry"
  >
    <!-- Handle bar -->
    <div class="sheet-handle" aria-hidden="true">
      <div class="handle-bar"></div>
    </div>

    <!-- Status text -->
    <div class="sheet-status">{statusText}</div>

    <!-- Waveform (visible during recording) -->
    {#if voiceState === 'recording'}
      <div class="waveform-container">
        <canvas
          bind:this={waveformCanvas}
          class="waveform-canvas"
          aria-label="audio waveform visualization"
        ></canvas>
      </div>

      <!-- Tap to stop hint -->
      <button
        class="stop-btn"
        onclick={() => finishRecording()}
        aria-label="stop recording"
      >
        <span class="stop-icon" aria-hidden="true">&#9632;</span>
        <span class="stop-label">ఆపండి</span>
      </button>
    {/if}

    <!-- Transcribing spinner -->
    {#if voiceState === 'transcribing'}
      <div class="transcribing-indicator">
        <div class="spinner" aria-hidden="true"></div>
      </div>
    {/if}

    <!-- Parsed result -->
    {#if parsedExpense && (voiceState === 'parsed' || voiceState === 'editing' || voiceState === 'confirming')}
      <div class="parsed-section">
        <ParsedExpenseCard
          parsed={parsedExpense}
          {editing}
          onedit={handleEditField}
        />
      </div>

      <!-- Action buttons -->
      <div class="sheet-actions">
        {#if editing}
          <button
            class="action-btn done-btn"
            onclick={handleEditDone}
            aria-label="finish editing"
          >
            &#10003; అయింది
          </button>
        {:else}
          <button
            class="action-btn confirm-btn"
            onclick={handleConfirm}
            aria-label="confirm and save"
          >
            &#10003; సరే
          </button>
          <button
            class="action-btn edit-btn"
            onclick={handleEdit}
            aria-label="edit before saving"
          >
            &#9998; మార్చు
          </button>
        {/if}
      </div>
    {/if}

    <!-- Saving / Saved feedback -->
    {#if voiceState === 'saving'}
      <div class="saving-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <span>సేవ్ చేస్తున్నాను...</span>
      </div>
    {/if}

    {#if voiceState === 'saved'}
      <div class="saved-indicator">
        <span class="saved-check" aria-hidden="true">&#10003;</span>
        <span>సేవ్ అయింది!</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Overlay */
  .voice-overlay {
    position: fixed;
    inset: 0;
    background: rgba(28, 20, 16, 0.4);
    z-index: 149;
    animation: overlayFadeIn 233ms ease forwards;
  }

  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Sheet */
  .voice-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--patti);
    border-radius: 21px 21px 0 0;
    padding: var(--space-13) var(--space-21) var(--space-34);
    z-index: 150;
    box-shadow: 0 -4px 21px rgba(0, 0, 0, 0.12);
    animation: sheetSlideUp 377ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    max-height: 85vh;
    overflow-y: auto;
  }

  @keyframes sheetSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* Handle bar */
  .sheet-handle {
    display: flex;
    justify-content: center;
    padding: var(--space-5) 0 var(--space-13);
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--nalupurugu);
  }

  /* Status text */
  .sheet-status {
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    font-weight: 400;
    color: var(--ink-primary);
    text-align: center;
    margin-bottom: var(--space-21);
    min-height: 1.5em;
  }

  /* Waveform */
  .waveform-container {
    width: 100%;
    height: 55px;
    margin-bottom: var(--space-21);
  }

  .waveform-canvas {
    width: 100%;
    height: 55px;
    display: block;
  }

  /* Stop button */
  .stop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    margin: 0 auto var(--space-21);
    padding: var(--space-8) var(--space-21);
    background: var(--erra);
    color: var(--patti);
    border-radius: var(--radius-pill);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    font-weight: 600;
    min-height: 48px;
    min-width: 120px;
    transition: transform var(--dur-233) var(--spring);
  }

  .stop-btn:active { transform: scale(0.95); }

  .stop-icon { font-size: 12px; }

  /* Transcribing spinner */
  .transcribing-indicator {
    display: flex;
    justify-content: center;
    padding: var(--space-21) 0;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--nalupurugu);
    border-top-color: var(--pasupu);
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Parsed section */
  .parsed-section {
    margin-bottom: var(--space-21);
    animation: parsedFadeIn 377ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes parsedFadeIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  /* Action buttons */
  .sheet-actions {
    display: flex;
    gap: var(--space-8);
  }

  .action-btn {
    flex: 1;
    padding: var(--space-13) var(--space-21);
    border-radius: 3px 13px 5px 8px;
    font-family: var(--font-te);
    font-size: var(--text-base);
    font-weight: 600;
    min-height: 48px;
    transition: transform var(--dur-233) var(--spring), box-shadow var(--dur-233) ease;
    cursor: pointer;
  }

  .action-btn:active {
    transform: scale(0.96);
    transition-duration: var(--dur-89);
  }

  .confirm-btn, .done-btn {
    background: var(--pacchi);
    color: var(--patti);
    box-shadow: 0 2px 8px rgba(45, 106, 79, 0.3);
  }

  .confirm-btn:hover, .done-btn:hover {
    box-shadow: 0 4px 13px rgba(45, 106, 79, 0.4);
    transform: translateY(-1px);
  }

  .edit-btn {
    background: var(--patti-warm);
    color: var(--neeli);
    border: 1px solid var(--nalupurugu);
  }

  .edit-btn:hover {
    background: var(--neeli-glow);
    transform: translateY(-1px);
  }

  /* Saving / Saved indicators */
  .saving-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-13);
    padding: var(--space-21);
    font-family: var(--font-te);
    color: var(--ink-tertiary);
  }

  .saved-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    padding: var(--space-21);
    font-family: var(--font-te);
    font-weight: 600;
    color: var(--pacchi);
    animation: savedBounce 377ms var(--spring) both;
  }

  @keyframes savedBounce {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }

  .saved-check {
    font-size: var(--text-xl);
  }
</style>
