<script lang="ts">
  import { onMount } from 'svelte';
  import { chatState } from '../lib/chat';
  import { startRecording, stopRecording, isRecording } from '../lib/voice';
  import { imageToBase64, performOcr, extractBillData, type OcrResult } from '../lib/ocr';

  interface PendingImage {
    file: File;
    previewUrl: string;
    ocrResult?: OcrResult;
    ocrRunning: boolean;
  }

  interface Props {
    onsend: (text: string, imageUrl?: string, displayText?: string) => void;
    onvoice: (blob: Blob) => void;
  }

  let { onsend, onvoice }: Props = $props();

  let inputText = $state('');
  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let fileInputEl: HTMLInputElement | null = $state(null);
  let recording = $state(false);
  let waveformCanvas: HTMLCanvasElement | null = $state(null);
  let waveformRAF: number | null = null;
  let waveformTime = 0;

  // Pending image state -- photo selected but not yet sent
  let pendingImage: PendingImage | null = $state(null);

  function handleSend() {
    const trimmed = inputText.trim();
    const hasImage = pendingImage !== null;

    if (!trimmed && !hasImage) return;

    if (hasImage) {
      // Build composite message: user context + OCR data behind the scenes
      const userText = trimmed || '';
      const ocr = pendingImage!.ocrResult;

      let messageForAI = userText;

      if (ocr && ocr.text.trim()) {
        const billData = extractBillData(ocr.text);
        const ocrSection = `\n\n[OCR extracted text: ${ocr.text.slice(0, 500)}]`;
        const amountsSection = billData.totalAmount
          ? `\n[Total amount: \u20B9${(billData.totalAmount / 100).toLocaleString('en-IN')}]`
          : '';
        const shopSection = billData.shopName
          ? `\n[Shop: ${billData.shopName}]`
          : '';
        const dateSection = billData.date
          ? `\n[Date: ${billData.date}]`
          : '';

        messageForAI = `${userText || '\u0C08 \u0C2B\u0C4B\u0C1F\u0C4B \u0C1A\u0C42\u0C21\u0C02\u0C21\u0C3F'}${ocrSection}${amountsSection}${shopSection}${dateSection}`;
      } else if (!userText) {
        // No OCR result and no text -- default message
        messageForAI = '\u0C08 \u0C2B\u0C4B\u0C1F\u0C4B \u0C1A\u0C42\u0C21\u0C02\u0C21\u0C3F';
      }

      // Convert blob URL to data URL for persistence, then send
      // Pass BOTH: full message for AI (with OCR) and clean display text (without OCR)
      const displayText = trimmed || 'ఈ ఫోటో చూడండి';
      const img = pendingImage!;
      convertToDataUrl(img.file).then((dataUrl) => {
        onsend(messageForAI, dataUrl, displayText);
      }).catch(() => {
        onsend(messageForAI, undefined, displayText);
      });

      clearPendingImage();
    } else {
      onsend(trimmed);
    }

    inputText = '';
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
  }

  /** Convert a File to a data URL for persistence in localStorage. */
  async function convertToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a smaller thumbnail for storage (max 200px)
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_THUMB = 200;
          const scale = Math.min(1, MAX_THUMB / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('no canvas ctx')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    if (textareaEl) {
      textareaEl.style.height = 'auto';
      textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
    }
  }

  async function toggleRecording() {
    if (recording) {
      // Stop recording
      recording = false;
      stopWaveform();
      try {
        const blob = await stopRecording();
        if (blob.size > 0) {
          onvoice(blob);
        }
      } catch {
        // Recording may not have started
      }
    } else {
      // Start recording
      recording = true;
      try {
        await startRecording();
        startWaveform();
      } catch {
        recording = false;
        // Mic not available
      }
    }
  }

  /** Open the file picker for camera/gallery photos. */
  function handleCameraClick() {
    fileInputEl?.click();
  }

  /** Handle photo file selection -- stage as pending, start background OCR. */
  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      pendingImage = { file, previewUrl, ocrRunning: true };

      // Start OCR in background while user types context
      processOcrInBackground(file);
    }
    // Reset so the same file can be selected again
    input.value = '';
  }

  /** Run OCR in background -- doesn't block UI. */
  async function processOcrInBackground(file: File) {
    try {
      const base64 = await imageToBase64(file);
      const result = await performOcr(base64);
      if (pendingImage && pendingImage.file === file) {
        pendingImage = { ...pendingImage, ocrResult: result, ocrRunning: false };
      }
    } catch (err) {
      console.warn('[ChatInput] Background OCR failed:', err);
      if (pendingImage && pendingImage.file === file) {
        pendingImage = { ...pendingImage, ocrRunning: false };
      }
    }
  }

  /** Remove the pending image. */
  function clearPendingImage() {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.previewUrl);
      pendingImage = null;
    }
  }

  // --- Waveform ---
  function startWaveform() {
    if (!waveformCanvas) return;
    const canvas = waveformCanvas;
    canvas.width = canvas.offsetWidth || 200;
    canvas.height = canvas.offsetHeight || 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cy = H / 2;

    function drawFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      waveformTime += 0.06;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const y = cy + Math.sin(x * 0.05 + waveformTime * 2.5) * cy * 0.6
          + Math.sin(x * 0.08 + waveformTime * 1.7) * cy * 0.3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(232, 163, 23, 0.7)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
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
      if (ctx) ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }
  }

  onMount(() => {
    return () => {
      stopWaveform();
      if (pendingImage) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
    };
  });

  const isDisabled = $derived(
    $chatState === 'thinking' || $chatState === 'responding' || $chatState === 'transcribing'
  );

  // Send button enabled when there's text OR a pending image
  const canSend = $derived(
    (inputText.trim().length > 0 || pendingImage !== null) && !isDisabled
  );

  const placeholder = $derived(
    pendingImage
      ? '\u0C08 \u0C2B\u0C4B\u0C1F\u0C4B \u0C17\u0C41\u0C30\u0C3F\u0C02\u0C1A\u0C3F \u0C1A\u0C46\u0C2A\u0C4D\u0C2A\u0C02\u0C21\u0C3F...'  // ఈ ఫోటో గురించి చెప్పండి...
      : '\u0C1F\u0C48\u0C2A\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F...'  // టైప్ చేయండి...
  );
</script>

<!-- Hidden file input for camera/gallery -->
<input
  bind:this={fileInputEl}
  type="file"
  accept="image/*"
  capture="environment"
  class="hidden-file-input"
  onchange={handleFileChange}
/>

<div class="chat-input-wrap">
  <!-- Pending image preview (above the input row) -->
  {#if pendingImage}
    <div class="pending-image-bar">
      <div class="pending-thumb-wrap">
        <img
          src={pendingImage.previewUrl}
          alt="bill attachment"
          class="pending-thumb"
        />
        {#if pendingImage.ocrRunning}
          <div class="ocr-spinner" aria-label="OCR processing"></div>
        {:else if pendingImage.ocrResult}
          <div class="ocr-done-badge" aria-label="OCR complete">&#10003;</div>
        {/if}
      </div>
      <div class="pending-info">
        {#if pendingImage.ocrRunning}
          <span class="pending-status">&#128248; చదువుతున్నాను...</span>
        {:else if pendingImage.ocrResult && extractBillData(pendingImage.ocrResult.text).totalAmount}
          <span class="pending-status">&#8377;{((extractBillData(pendingImage.ocrResult.text).totalAmount ?? 0) / 100).toLocaleString('en-IN')} కనుగొనబడింది</span>
        {:else if pendingImage.ocrResult}
          <span class="pending-status">&#128248; ఫోటో సిద్ధం</span>
        {:else}
          <span class="pending-status">&#128248; ఫోటో జతచేయబడింది</span>
        {/if}
      </div>
      <button
        class="pending-remove"
        onclick={clearPendingImage}
        aria-label="remove photo"
      >&#10005;</button>
    </div>
  {/if}

  {#if recording}
    <div class="recording-area">
      <canvas bind:this={waveformCanvas} class="input-waveform" aria-label="recording waveform"></canvas>
      <button class="stop-rec-btn" onclick={toggleRecording} aria-label="stop recording">
        <span class="stop-square" aria-hidden="true">&#9632;</span>
        ఆపండి
      </button>
    </div>
  {:else}
    <div class="input-row">
      <!-- Voice button -->
      <button
        class="icon-btn mic-btn"
        onclick={toggleRecording}
        disabled={isDisabled}
        aria-label="voice input"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      </button>

      <!-- Camera button -->
      <button
        class="icon-btn camera-btn"
        onclick={handleCameraClick}
        disabled={isDisabled}
        aria-label="take photo of bill"
        title="బిల్లు ఫోటో తీయండి"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/>
          <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
        </svg>
      </button>

      <!-- Text area -->
      <textarea
        bind:this={textareaEl}
        bind:value={inputText}
        class="chat-textarea"
        placeholder={placeholder}
        rows={1}
        oninput={handleInput}
        onkeydown={handleKeydown}
        disabled={isDisabled}
      ></textarea>

      <!-- Send button -->
      <button
        class="icon-btn send-btn"
        onclick={handleSend}
        disabled={!canSend}
        aria-label="send message"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  .hidden-file-input {
    display: none;
  }

  .chat-input-wrap {
    padding: var(--space-8) var(--space-13);
    background: var(--patti);
    border-top: 1px solid var(--nalupurugu-soft);
  }

  /* --- Pending image preview bar --- */
  .pending-image-bar {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-5) var(--space-8);
    margin-bottom: var(--space-8);
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card-sm);
    animation: fadeUp var(--dur-233) var(--ease-out) both;
  }

  .pending-thumb-wrap {
    position: relative;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
  }

  .pending-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    border: 2px solid var(--nalupurugu);
  }

  .ocr-spinner {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border: 2px solid var(--pasupu);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .ocr-done-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    background: var(--pacchi);
    color: white;
    border-radius: 50%;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .pending-info {
    flex: 1;
    min-width: 0;
  }

  .pending-status {
    font-family: var(--font-te);
    font-size: var(--text-xs);
    color: var(--ink-secondary);
  }

  .pending-remove {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-tertiary);
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--dur-144) ease, color var(--dur-144) ease;
  }

  .pending-remove:hover {
    background: var(--erra-soft);
    color: var(--erra);
  }

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-5);
  }

  .chat-textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-card-sm);
    padding: var(--space-8) var(--space-13);
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    background: var(--patti-warm);
    outline: none;
    min-height: 40px;
    max-height: 120px;
    line-height: 1.5;
    transition: border-color var(--dur-233) ease;
  }

  .chat-textarea:focus {
    border-color: var(--pasupu);
  }

  .chat-textarea:disabled {
    opacity: 0.6;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform var(--dur-233) var(--spring), opacity var(--dur-233) ease;
  }

  .icon-btn:active { transform: scale(0.9); }
  .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .mic-btn {
    background: var(--patti-warm);
    color: var(--ink-secondary);
    border: 1px solid var(--nalupurugu);
  }

  .camera-btn {
    background: var(--patti-warm);
    color: var(--ink-secondary);
    border: 1px solid var(--nalupurugu);
  }

  .send-btn {
    background: var(--pasupu);
    color: white;
  }

  .send-btn:disabled {
    background: var(--nalupurugu);
    color: var(--ink-faint);
  }

  /* Recording mode */
  .recording-area {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .input-waveform {
    flex: 1;
    height: 32px;
    display: block;
  }

  .stop-rec-btn {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-5) var(--space-13);
    background: var(--erra);
    color: white;
    border-radius: var(--radius-pill);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    font-weight: 600;
    min-height: 36px;
    cursor: pointer;
    transition: transform var(--dur-233) var(--spring);
  }

  .stop-rec-btn:active { transform: scale(0.95); }

  .stop-square {
    font-size: 10px;
  }
</style>
