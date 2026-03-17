<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import ConfirmCard from './ConfirmCard.svelte';
  import {
    activeMessages,
    activeConversation,
    conversations,
    chatState,
    sendMessage,
    sendVoice,
    createConversation,
    switchConversation,
    deleteConversation,
    relativeTime,
    extractActions,
    type ChatAction,
  } from '../lib/chat';
  import { activeScreen } from '../lib/stores';
  import { executeUndo, getPendingUndo, clearUndo } from '../lib/actions';

  interface Props {
    onclose: () => void;
    onaction: (action: ChatAction) => void;
  }

  let { onclose, onaction }: Props = $props();

  let messagesEl: HTMLDivElement | null = $state(null);
  let panelEl: HTMLDivElement | null = $state(null);

  // Pending action for confirmation
  let pendingAction: ChatAction | null = $state(null);

  // Conversation history drawer state
  let historyOpen = $state(false);

  // Undo state
  let undoVisible = $state(false);
  let undoLabel = $state('');
  let undoCountdown = $state(30);
  let undoInterval: ReturnType<typeof setInterval> | null = null;

  // Auto-scroll to bottom when messages change
  $effect(() => {
    const _msgs = $activeMessages; // subscribe
    void _msgs;
    tick().then(() => {
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  });

  async function handleSend(text: string, imageUrl?: string, displayText?: string) {
    pendingAction = null;
    const actions = await sendMessage(text, $activeScreen, imageUrl, displayText);
    if (actions.length > 0) {
      pendingAction = actions[0];
    }
  }

  async function handleVoice(blob: Blob) {
    pendingAction = null;
    const actions = await sendVoice(blob, $activeScreen);
    if (actions.length > 0) {
      pendingAction = actions[0];
    }
  }

  // Photo handling is now entirely in ChatInput (pending image + background OCR).
  // ChatInput calls onsend(text, imageUrl) when user taps send.

  function handleConfirm(action: ChatAction) {
    onaction(action);
    pendingAction = null;
    chatState.set('idle');
    // Show undo button after action execution
    showUndoButton();
  }

  function handleEdit(action: ChatAction) {
    // Replace pending with edited version
    pendingAction = action;
  }

  function handleDismiss() {
    pendingAction = null;
    chatState.set('idle');
  }

  function handleNewChat() {
    createConversation();
    pendingAction = null;
    historyOpen = false;
  }

  function handleSwitchConversation(id: string) {
    switchConversation(id);
    pendingAction = null;
    historyOpen = false;
  }

  function handleDeleteConversation(e: MouseEvent, id: string) {
    e.stopPropagation();
    deleteConversation(id);
  }

  function toggleHistory() {
    historyOpen = !historyOpen;
  }

  function handleOverlayClick() {
    if (historyOpen) {
      historyOpen = false;
      return;
    }
    onclose();
  }

  function handlePanelClick(e: MouseEvent) {
    e.stopPropagation();
  }

  // --- Undo ---
  function showUndoButton() {
    const undo = getPendingUndo();
    if (!undo) return;
    undoVisible = true;
    undoLabel = undo.label;
    undoCountdown = 30;

    if (undoInterval) clearInterval(undoInterval);
    undoInterval = setInterval(() => {
      undoCountdown--;
      if (undoCountdown <= 0 || !getPendingUndo()) {
        hideUndo();
      }
    }, 1000);
  }

  function hideUndo() {
    undoVisible = false;
    if (undoInterval) {
      clearInterval(undoInterval);
      undoInterval = null;
    }
    clearUndo();
  }

  async function handleUndo() {
    const result = await executeUndo();
    hideUndo();
    if (result.success) {
      await sendMessage(`↩️ రద్దు చేయబడింది`, $activeScreen);
    }
  }

  // Status text for states
  function stateText(state: string): string {
    switch (state) {
      case 'transcribing': return 'వింటున్నాను...';
      case 'thinking': return 'ఆలోచిస్తున్నాను...';
      case 'responding': return '';
      case 'searching': return 'వెతుకుతున్నాను...';
      default: return '';
    }
  }

  onMount(() => {
    // Focus animation
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    return () => {
      if (undoInterval) clearInterval(undoInterval);
    };
  });
</script>

<!-- Overlay -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="chat-overlay" onclick={handleOverlayClick} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <!-- Panel -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    bind:this={panelEl}
    class="chat-panel"
    onclick={handlePanelClick}
    role="dialog"
    aria-modal="true"
    aria-label="chat conversation"
  >
    <!-- Conversation header -->
    <div class="panel-header">
      <div class="header-top">
        <div class="handle-bar" aria-hidden="true"></div>
      </div>
      <div class="header-row">
        <!-- History toggle -->
        <button class="header-btn history-btn" onclick={toggleHistory} aria-label="conversation history">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
          </svg>
          {#if $conversations.length > 1}
            <span class="history-count">{$conversations.length}</span>
          {/if}
        </button>

        <!-- Conversation title -->
        <span class="conv-title">
          {$activeConversation?.title ?? 'రైతు మిత్ర'}
        </span>

        <!-- New conversation -->
        <button class="header-btn new-chat-btn" onclick={handleNewChat} aria-label="new conversation">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>

        <!-- Close -->
        <button class="header-btn close-btn" onclick={onclose} aria-label="close chat">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Conversation history drawer -->
    {#if historyOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="history-drawer" onclick={(e) => e.stopPropagation()}>
        <div class="history-header">
          <span class="history-title">సంభాషణలు</span>
          <button class="header-btn" onclick={() => historyOpen = false} aria-label="close history">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div class="history-list">
          {#each $conversations as conv (conv.id)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="history-item"
              class:active={conv.id === $activeConversation?.id}
              onclick={() => handleSwitchConversation(conv.id)}
            >
              <div class="history-item-content">
                <span class="history-item-title">{conv.title}</span>
                <span class="history-item-meta">
                  {conv.messages.length} msgs &middot; {relativeTime(conv.updatedAt)}
                </span>
              </div>
              {#if $conversations.length > 1}
                <button
                  class="history-delete"
                  onclick={(e) => handleDeleteConversation(e, conv.id)}
                  aria-label="delete conversation"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Messages list -->
    <div bind:this={messagesEl} class="messages-list">
      {#if $activeMessages.length === 0}
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">రైతు మిత్ర</div>
          <div class="empty-hint">మీ ఖర్చులు, మార్కెట్ ధరలు, పంట సలహా — ఏదైనా అడగండి!</div>
          <div class="empty-examples">
            <button class="example-pill" onclick={() => handleSend('హాలో')}>హాలో 🙏</button>
            <button class="example-pill" onclick={() => handleSend('కూలి 400')}>కూలి 400</button>
            <button class="example-pill" onclick={() => handleSend('నా బ్యాలెన్స్?')}>నా బ్యాలెన్స్?</button>
            <button class="example-pill" onclick={() => handleSend('వేరుశెనగ ధర?')}>వేరుశెనగ ధర?</button>
          </div>
        </div>
      {:else}
        {#each $activeMessages as msg (msg.id)}
          <ChatMessage message={msg} />
        {/each}
      {/if}

      <!-- Status indicator -->
      {#if stateText($chatState)}
        <div class="state-indicator">
          <div class="thinking-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <span class="state-text">{stateText($chatState)}</span>
        </div>
      {/if}

      <!-- Confirmation card -->
      {#if pendingAction}
        <ConfirmCard
          action={pendingAction}
          onconfirm={handleConfirm}
          onedit={handleEdit}
          ondismiss={handleDismiss}
        />
      {/if}

      <!-- Undo button -->
      {#if undoVisible}
        <div class="undo-bar">
          <button class="undo-btn" onclick={handleUndo}>
            ↩️ రద్దు: {undoLabel}
          </button>
          <span class="undo-countdown">{undoCountdown}s</span>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <ChatInput onsend={handleSend} onvoice={handleVoice} />
  </div>
</div>

<style>
  .chat-overlay {
    position: fixed;
    inset: 0;
    background: rgba(28, 20, 16, 0.35);
    z-index: var(--z-sheet, 150);
    animation: overlayIn var(--dur-233) ease forwards;
  }

  @keyframes overlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .chat-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 62vh;
    max-height: 90vh;
    background: var(--patti);
    border-radius: 21px 21px 0 0;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 21px rgba(0, 0, 0, 0.15);
    animation: panelSlideUp var(--dur-377) cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    overflow: hidden;
  }

  @keyframes panelSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* Conversation header */
  .panel-header {
    flex-shrink: 0;
    padding: var(--space-5) var(--space-13) 0;
  }

  .header-top {
    display: flex;
    justify-content: center;
    padding-bottom: var(--space-5);
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--nalupurugu);
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--nalupurugu-soft);
  }

  .header-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-tertiary);
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--dur-233) ease, color var(--dur-233) ease;
    position: relative;
  }

  .header-btn:hover {
    background: var(--nalupurugu-soft);
    color: var(--ink-primary);
  }

  .history-btn {
    position: relative;
  }

  .history-count {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--pasupu);
    color: white;
    font-size: 9px;
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .conv-title {
    flex: 1;
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }

  .new-chat-btn {
    color: var(--pacchi);
  }

  .new-chat-btn:hover {
    background: var(--pacchi-soft);
    color: var(--pacchi);
  }

  /* History drawer */
  .history-drawer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--patti);
    z-index: 10;
    display: flex;
    flex-direction: column;
    animation: drawerSlideIn var(--dur-233) var(--ease-out) both;
  }

  @keyframes drawerSlideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-13);
    border-bottom: 1px solid var(--nalupurugu-soft);
    flex-shrink: 0;
  }

  .history-title {
    font-family: var(--font-te-display);
    font-size: var(--text-lg);
    color: var(--ink-primary);
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-5) 0;
  }

  .history-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--space-8) var(--space-13);
    text-align: left;
    cursor: pointer;
    transition: background var(--dur-144) ease;
    gap: var(--space-8);
  }

  .history-item:hover {
    background: var(--nalupurugu-soft);
  }

  .history-item.active {
    background: var(--pasupu-glow);
    border-left: 3px solid var(--pasupu);
  }

  .history-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .history-item-title {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    color: var(--ink-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-item-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-faint);
  }

  .history-delete {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-faint);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--dur-144) ease, background var(--dur-144) ease, color var(--dur-144) ease;
  }

  .history-item:hover .history-delete {
    opacity: 1;
  }

  .history-delete:hover {
    background: var(--erra-soft);
    color: var(--erra);
  }

  .messages-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-8) var(--space-13);
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-34) var(--space-21);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-13);
  }

  .empty-title {
    font-family: var(--font-te-display);
    font-size: var(--text-xl);
    color: var(--ink-primary);
    margin-bottom: var(--space-5);
  }

  .empty-hint {
    font-size: var(--text-sm);
    color: var(--ink-tertiary);
    max-width: 280px;
    line-height: 1.5;
    margin-bottom: var(--space-21);
  }

  .empty-examples {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    justify-content: center;
  }

  .example-pill {
    padding: var(--space-5) var(--space-13);
    background: var(--patti-warm);
    border: 1px solid var(--nalupurugu);
    border-radius: var(--radius-pill);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    color: var(--ink-secondary);
    cursor: pointer;
    transition: all var(--dur-233) var(--spring);
  }

  .example-pill:hover {
    border-color: var(--pasupu);
    transform: translateY(-1px);
  }

  .example-pill:active {
    transform: scale(0.95);
  }

  /* Thinking dots */
  .state-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-8) var(--space-13);
    animation: fadeUp var(--dur-233) ease both;
  }

  .state-text {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
  }

  .thinking-dots {
    display: flex;
    gap: 4px;
  }

  .thinking-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--pasupu);
    animation: dotBounce 1.2s ease-in-out infinite;
  }

  .thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes dotBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Undo bar */
  .undo-bar {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-5) var(--space-8);
    margin-top: var(--space-8);
    background: var(--patti-warm);
    border: 1px dashed var(--nalupurugu);
    border-radius: var(--radius-card-xs, 6px);
    animation: fadeUp var(--dur-233) ease both;
  }

  .undo-btn {
    flex: 1;
    padding: var(--space-5) var(--space-8);
    background: transparent;
    border: 1px solid var(--pasupu);
    border-radius: var(--radius-pill);
    font-family: var(--font-te);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--pasupu);
    cursor: pointer;
    transition: all var(--dur-233) var(--spring);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .undo-btn:hover {
    background: var(--pasupu);
    color: white;
  }

  .undo-btn:active {
    transform: scale(0.97);
  }

  .undo-countdown {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    flex-shrink: 0;
    min-width: 28px;
    text-align: right;
  }
</style>
