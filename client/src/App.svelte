<script lang="ts">
  import { activeScreen, connected } from './lib/stores';
  import { connect } from './lib/db';
  import { showToast } from './lib/toast';
  import KolamCanvas from './components/KolamCanvas.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import ChatBar from './components/ChatBar.svelte';
  import ChatPanel from './components/ChatPanel.svelte';
  import OnboardingFlow from './components/OnboardingFlow.svelte';
  import Toast from './components/Toast.svelte';
  import Home from './screens/Home.svelte';
  import Dabbu from './screens/Dabbu.svelte';
  import Market from './screens/Market.svelte';
  import Panta from './screens/Panta.svelte';
  import Settings from './screens/Settings.svelte';
  import type { ChatAction } from './lib/chat';
  import { chatState } from './lib/chat';
  import { onNetworkChange } from './lib/network';
  import { executeAction } from './lib/actions';

  // ---------------------------------------------------------------------------
  // Onboarding: show OnboardingFlow for first-time users.
  // Demo mode (?demo=true or localStorage 'rythu_mitra_demo_mode') bypasses this.
  // ---------------------------------------------------------------------------
  function checkNeedsOnboarding(): boolean {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') return false;
    if (localStorage.getItem('rythu_mitra_demo_mode') === 'true') return false;
    return localStorage.getItem('rythu_mitra_onboarded') !== 'true';
  }

  let needsOnboarding = $state(checkNeedsOnboarding());

  function handleOnboardingComplete() {
    needsOnboarding = false;
    // Farmer registration is triggered by OnboardingFlow itself via getConnection().
    // If STDB was connected before onboarding finished, the reducers were called there.
    // If not yet connected, ensureFarmerRegistered() in db.ts will pick it up on connect.
    showToast('స్వాగతం! రైతు మిత్ర కి వచ్చారు 🌾', 'default', 4000);
  }

  // Screen transition state
  let transitioning = $state(false);
  let displayScreen = $state($activeScreen);

  // Chat panel state
  let chatPanelOpen = $state(false);

  // Watch for screen changes and animate transitions
  let prevScreen = $activeScreen;
  $effect(() => {
    const next = $activeScreen;
    if (next !== prevScreen) {
      transitioning = true;
      // Fade out current (144ms)
      setTimeout(() => {
        displayScreen = next;
        // Fade in next (233ms) happens via CSS
        setTimeout(() => {
          transitioning = false;
        }, 233);
      }, 144);
      prevScreen = next;
    }
  });

  function handleOpenChat() {
    chatPanelOpen = true;
  }

  function handleCloseChat() {
    chatPanelOpen = false;
  }

  // DIAGNOSTIC REPORT (2026-03-17):
  //
  // GAP FOUND AND FIXED: App.svelte previously handled record_money and
  // record_from_bill via an inline recordMoneyFromChat() that bypassed
  // executeAction() in actions.ts. This caused two problems:
  //   1. The undo system (setUndo/getPendingUndo) was never called for these
  //      actions, so ChatPanel.showUndoButton() always found null and the undo
  //      button never appeared after "సరే" confirmation.
  //   2. Two separate code paths existed for the same operation, diverging in
  //      season string ('rabi_2025' vs 'rabi_2026'), category encoding, and
  //      idempotency key generation.
  //
  // FIX: Route ALL action types through executeAction() from actions.ts.
  // This ensures: STDB write -> undo registration -> toast -> TTS.
  // record_crop still calls executeAction which routes to handleRecordCrop.
  //
  // DATA FLOW (types at each step):
  //   ChatInput.onsend(text: string)
  //     -> ChatPanel.handleSend(text)
  //     -> chat.ts:sendMessage() -> ChatAction[] (action: string, [key]: unknown)
  //     -> ChatPanel: pendingAction = actions[0]  (type: ChatAction from chat.ts)
  //     -> ConfirmCard: action prop              (type: ChatAction from chat.ts)
  //     -> ConfirmCard.handleConfirm()
  //     -> onconfirm(action)                     (type: ChatAction from chat.ts)
  //     -> ChatPanel.handleConfirm(action)
  //     -> onaction(action)                      (type: ChatAction from chat.ts)
  //     -> App.svelte.handleChatAction(action)   (type: ChatAction from chat.ts)
  //     -> executeAction(action)                 (accepts ChatAction from actions.ts)
  //
  // TYPE NOTE: chat.ts:ChatAction and actions.ts:ChatAction are structurally
  // identical ({ action: string; [key: string]: unknown }). App.svelte imports
  // from chat.ts (line 15). executeAction accepts actions.ts:ChatAction.
  // TypeScript structural typing makes these compatible -- no cast needed.
  //
  // STDB BINDING VERIFIED (record_money_event_reducer.ts):
  //   kind: string, amountPaise: u64, isIncome: bool, category: string,
  //   description: string, partyName: string, season: string, idempotencyKey: string
  //   -- actions.ts:handleRecordMoney calls BigInt(amountPaise) -- CORRECT.
  //
  // UNDO VERIFIED: executeAction -> handleRecordMoney -> setUndo() is called.
  // ChatPanel.showUndoButton() -> getPendingUndo() now returns the undo action.
  // Undo button appears with 30s countdown after each confirmed write.
  //
  // TTS NOTE: speakTelugu is called from actions.ts via the toast message only.
  // If TTS confirmation after record_money is needed, it should be wired in
  // actions.ts:handleRecordMoney, not here. Current: toast only, no TTS.

  async function handleChatAction(action: ChatAction) {
    // All action types route through executeAction for consistent:
    //   - STDB write path
    //   - Undo registration
    //   - ActionResult message (Telugu)
    if (
      action.action === 'record_money' ||
      action.action === 'record_from_bill' ||
      action.action === 'record_crop' ||
      action.action === 'update_money' ||
      action.action === 'delete_money' ||
      action.action === 'remember' ||
      action.action === 'check_scheme'
    ) {
      const result = await executeAction(action);
      showToast(result.message, result.success ? 'default' : 'warning', 4000);
    } else if (action.action === 'web_search') {
      showToast('వెతుకుతున్నాము...', 'default', 3000);
    }
    chatState.set('idle');
  }

  function handleScreenToast(message: string, type: string) {
    showToast(message, type as 'default' | 'warning' | 'alert');
  }

  // Connect to STDB
  import { onMount } from 'svelte';
  onMount(() => {
    connect();

    // Monitor network changes and notify user
    const unsubNetwork = onNetworkChange((isOnline) => {
      if (isOnline) {
        showToast('ఇంటర్నెట్ తిరిగి వచ్చింది', 'default', 3000);
      } else {
        showToast('ఇంటర్నెట్ కనెక్షన్ లేదు — ఆఫ్‌లైన్ మోడ్', 'warning', 5000);
      }
    });

    return () => {
      unsubNetwork();
    };
  });
</script>

<!-- Onboarding overlay (shown for first-time users) -->
{#if needsOnboarding}
  <OnboardingFlow oncomplete={handleOnboardingComplete} />
{/if}

<!-- Connection status indicator + settings gear -->
<div class="top-bar">
  <div class="stdb-status" class:online={$connected}>
    <div class="stdb-dot"></div>
    <span class="stdb-label">{$connected ? 'లైవ్' : 'ఆఫ్‌లైన్'}</span>
  </div>
  <button
    class="settings-gear"
    onclick={() => activeScreen.set('settings')}
    aria-label="settings"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z"/>
    </svg>
  </button>
</div>

<!-- Kolam background -->
<KolamCanvas />

<!-- Toast system -->
<Toast />

<!-- Screen content -->
<div class="screen-container" class:exit={transitioning}>
  {#if displayScreen === 'home'}
    <Home />
  {:else if displayScreen === 'dabbu'}
    <Dabbu ontoast={handleScreenToast} />
  {:else if displayScreen === 'market'}
    <Market />
  {:else if displayScreen === 'panta'}
    <Panta ontoast={handleScreenToast} />
  {:else if displayScreen === 'settings'}
    <Settings ontoast={handleScreenToast} />
  {/if}
</div>

<!-- Chat Bar (collapsed, above BottomNav) -->
<ChatBar onclick={handleOpenChat} />

<!-- Chat Panel (expandable overlay) -->
{#if chatPanelOpen}
  <ChatPanel onclose={handleCloseChat} onaction={handleChatAction} />
{/if}

<!-- Bottom navigation -->
<BottomNav />

<style>
  .screen-container {
    position: relative;
    z-index: var(--z-content);
    min-height: 100vh;
    /* Extra padding at bottom for ChatBar (48px) + BottomNav (68px) */
    padding-bottom: 116px;
    transition:
      opacity var(--dur-233) ease,
      transform var(--dur-233) ease;
  }

  .screen-container.exit {
    opacity: 0;
    transform: translateY(-4px);
    transition-duration: var(--dur-144);
  }

  /* Top bar with connection status + settings gear */
  .top-bar {
    position: fixed;
    top: 8px;
    right: 12px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stdb-status {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    font-size: 10px;
    color: var(--ink-faint, #999);
    transition: opacity 0.3s ease;
    opacity: 0.7;
  }

  .stdb-status:hover { opacity: 1; }

  .settings-gear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    color: var(--ink-faint, #999);
    opacity: 0.7;
    transition: opacity 0.3s ease, transform 0.3s ease;
    cursor: pointer;
    padding: 0;
    border: none;
  }

  .settings-gear:hover {
    opacity: 1;
    transform: rotate(30deg);
  }

  .stdb-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--erra, #c0392b);
    transition: background 0.5s ease;
  }

  .stdb-status.online .stdb-dot {
    background: var(--pacchi, #27ae60);
    box-shadow: 0 0 4px var(--pacchi, #27ae60);
  }

  .stdb-label {
    font-family: var(--font-mono, monospace);
    letter-spacing: 0.5px;
  }
</style>
