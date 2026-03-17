/**
 * Chat engine for Rythu Mitra.
 *
 * Manages conversations, SSE streaming to Sarvam 105B,
 * action extraction from AI responses, and localStorage persistence.
 *
 * Architecture:
 *   - Conversations stored in localStorage (fast, offline-capable)
 *   - Each message has role, content, intent, optional action payload
 *   - SSE streaming: real-time token-by-token response rendering
 *   - Action blocks: JSON embedded in AI response for record/search/remember
 */

import { writable, derived, get } from 'svelte/store';
import { loadConfig, hasApiKey } from './sarvam';
import { transcribeAudio } from './sarvam';
import { buildCurrentSystemPrompt } from './context';
import { detectRecordIntent, generateFallbackAction } from './intent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;        // Full content (sent to AI, may include OCR metadata)
  displayContent?: string; // Clean content for UI display (no OCR metadata)
  intent?: string;
  action?: ChatAction | null;
  timestamp: number;
  streaming?: boolean;
  imageUrl?: string;  // Data URL or blob URL for photo attachments
}

export interface ChatAction {
  action: string;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ChatState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'responding'
  | 'confirming'
  | 'searching';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'rythu_mitra_conversations';
const ACTIVE_CONV_KEY = 'rythu_mitra_active_conversation';
const MAX_CONVERSATIONS = 20;      // Prune oldest beyond this
const MAX_HISTORY_TOKENS = 3000;   // Token budget for conversation history in API calls
const SYSTEM_PROMPT_TOKEN_BUDGET = 800; // Reserve for system prompt

// ---------------------------------------------------------------------------
// Think-tag stripping (Sarvam 105B emits <think>...</think> reasoning traces)
// ---------------------------------------------------------------------------

/**
 * Strip <think>...</think> reasoning blocks from AI output.
 * Safety: if stripping removes ALL content, return the inner text
 * rather than an empty string (better to show reasoning than nothing).
 */
function stripThinkTags(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
  if (stripped.length === 0 && text.trim().length > 0) {
    // Entire response was inside <think> tags — extract the inner content
    const inner = text.replace(/<\/?think>/g, '').trim();
    console.warn('[chat] stripThinkTags: entire response was inside <think> tags, showing inner content');
    return inner || text.trim();
  }
  return stripped;
}

/** Strip incomplete <think> blocks during streaming (no closing tag yet). */
function stripPartialThinkTag(text: string): string {
  // Remove complete think blocks
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  // Hide incomplete think block at the end (still streaming)
  cleaned = cleaned.replace(/<think>[\s\S]*$/g, '');
  return cleaned;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export const conversations = writable<Conversation[]>(loadConversations());
export const activeConversationId = writable<string>(loadActiveConvId());
export const chatState = writable<ChatState>('idle');

export const activeConversation = derived(
  [conversations, activeConversationId],
  ([$convs, $id]) => $convs.find(c => c.id === $id) ?? null,
);

export const activeMessages = derived(
  activeConversation,
  ($conv) => $conv?.messages ?? [],
);

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function loadActiveConvId(): string {
  return localStorage.getItem(ACTIVE_CONV_KEY) ?? '';
}

function persist(): void {
  let convs = get(conversations);
  // Prune oldest conversations beyond MAX_CONVERSATIONS
  if (convs.length > MAX_CONVERSATIONS) {
    convs = [...convs]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    // Update store silently (avoid infinite loop by checking length)
    conversations.set(convs);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
    localStorage.setItem(ACTIVE_CONV_KEY, get(activeConversationId));
  } catch {
    // localStorage full — silently ignore
  }
}

// Auto-persist on store changes
conversations.subscribe(() => persist());
activeConversationId.subscribe(() => persist());

// ---------------------------------------------------------------------------
// Conversation Management
// ---------------------------------------------------------------------------

export function createConversation(): string {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conv: Conversation = {
    id,
    title: 'కొత్త సంభాషణ',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  conversations.update(cs => [conv, ...cs]);
  activeConversationId.set(id);
  return id;
}

export function switchConversation(id: string): void {
  activeConversationId.set(id);
}

export function deleteConversation(id: string): void {
  conversations.update(cs => cs.filter(c => c.id !== id));
  const remaining = get(conversations);
  if (remaining.length > 0) {
    activeConversationId.set(remaining[0].id);
  } else {
    activeConversationId.set('');
  }
}

function ensureActiveConversation(): string {
  let id = get(activeConversationId);
  // Validate the ID actually points to an existing conversation
  // (covers stale IDs from localStorage after conversations were cleared)
  if (!id || !get(conversations).find(c => c.id === id)) {
    id = createConversation();
  }
  return id;
}

function addMessage(convId: string, msg: ChatMessage): void {
  conversations.update(cs =>
    cs.map(c => {
      if (c.id !== convId) return c;
      const updated = {
        ...c,
        messages: [...c.messages, msg],
        updatedAt: Date.now(),
      };
      // Auto-title from first user message
      if (c.messages.length === 0 && msg.role === 'user') {
        updated.title = msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '');
      }
      return updated;
    }),
  );
}

function updateLastAssistantMessage(convId: string, contentAppend: string): void {
  conversations.update(cs =>
    cs.map(c => {
      if (c.id !== convId) return c;
      const msgs = [...c.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].streaming) {
          msgs[i] = { ...msgs[i], content: msgs[i].content + contentAppend };
          break;
        }
      }
      return { ...c, messages: msgs, updatedAt: Date.now() };
    }),
  );
}

/** Replace the entire content of the last streaming assistant message. */
function replaceLastAssistantContent(convId: string, newContent: string): void {
  conversations.update(cs =>
    cs.map(c => {
      if (c.id !== convId) return c;
      const msgs = [...c.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].streaming) {
          msgs[i] = { ...msgs[i], content: newContent };
          break;
        }
      }
      return { ...c, messages: msgs, updatedAt: Date.now() };
    }),
  );
}

function finalizeAssistantMessage(convId: string): void {
  conversations.update(cs =>
    cs.map(c => {
      if (c.id !== convId) return c;
      const msgs = c.messages.map(m =>
        m.streaming ? { ...m, streaming: false } : m,
      );
      return { ...c, messages: msgs, updatedAt: Date.now() };
    }),
  );
}

function setAssistantAction(convId: string, action: ChatAction): void {
  conversations.update(cs =>
    cs.map(c => {
      if (c.id !== convId) return c;
      const msgs = [...c.messages];
      // Find the last assistant message
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], action };
          break;
        }
      }
      return { ...c, messages: msgs, updatedAt: Date.now() };
    }),
  );
}

// ---------------------------------------------------------------------------
// Action Extraction (robust multi-pattern matching)
// ---------------------------------------------------------------------------

export function extractActions(content: string): ChatAction[] {
  const actions: ChatAction[] = [];

  // Pattern 1: JSON on its own line at the end (preferred — per system prompt instruction)
  const endLinePattern = /\n(\{"action"\s*:\s*"[^"]+?"[\s\S]*?\})\s*$/;
  const endMatch = endLinePattern.exec(content);
  if (endMatch) {
    try {
      const parsed = JSON.parse(endMatch[1]);
      if (parsed.action) {
        actions.push(parsed as ChatAction);
        return actions;
      }
    } catch { /* try next pattern */ }
  }

  // Pattern 2: JSON anywhere — last occurrence wins (handles non-ideal placement)
  const allJsonPattern = /\{"action"\s*:\s*"[^"]+?"[^}]*\}/g;
  let lastMatch: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = allJsonPattern.exec(content)) !== null) {
    lastMatch = match[0];
  }
  if (lastMatch) {
    try {
      const parsed = JSON.parse(lastMatch);
      if (parsed.action) {
        actions.push(parsed as ChatAction);
        return actions;
      }
    } catch { /* try next pattern */ }
  }

  // Pattern 3: JSON wrapped in markdown code fences (Sarvam sometimes does this)
  const fencedPattern = /```(?:json)?\s*(\{"action"\s*:\s*"[^"]+?"[\s\S]*?\})\s*```/;
  const fencedMatch = fencedPattern.exec(content);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1]);
      if (parsed.action) {
        actions.push(parsed as ChatAction);
        return actions;
      }
    } catch { /* no valid JSON found */ }
  }

  return actions;
}

/**
 * Strip the action JSON block from the display text.
 * Returns clean text suitable for the chat bubble.
 */
export function stripActionFromContent(content: string): string {
  // Remove JSON on its own line at the end
  let cleaned = content.replace(/\n\s*\{"action"\s*:\s*"[^"]+?"[\s\S]*?\}\s*$/, '');
  // Remove fenced JSON blocks
  cleaned = cleaned.replace(/```(?:json)?\s*\{"action"\s*:\s*"[^"]+?"[\s\S]*?\}\s*```/g, '');
  // Remove inline JSON blocks that look like action blocks
  cleaned = cleaned.replace(/\{"action"\s*:\s*"[^"]+?"[^}]*\}/g, '');
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Context Window Management — Smart Message Selection for API
// ---------------------------------------------------------------------------

interface ApiMessage {
  role: string;
  content: string;
}

/**
 * Estimate token count for a string.
 * Telugu characters are multi-byte and typically use ~2 tokens each.
 * English/ASCII chars use ~0.25 tokens per char (4 chars per token).
 */
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    // Telugu Unicode range: U+0C00 to U+0C7F
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0C00 && code <= 0x0C7F) {
      tokens += 2;   // Telugu: ~2 tokens per character
    } else if (code > 0x7F) {
      tokens += 1.5;  // Other non-ASCII (devanagari, etc)
    } else {
      tokens += 0.25; // ASCII: ~4 chars per token
    }
  }
  return Math.ceil(tokens);
}

/**
 * Build the messages array for the Sarvam API call.
 *
 * Strategy:
 *   - Always include the system prompt
 *   - If conversation is short (<=10 messages), include ALL
 *   - For long conversations: first 2 messages (establish topic) + last 8 (recent context)
 *   - Respect MAX_HISTORY_TOKENS budget to avoid token overflow
 */
function buildMessagesForAPI(
  allMessages: ChatMessage[],
  systemPrompt: string,
): ApiMessage[] {
  const apiMessages: ApiMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Filter to only user/assistant messages (skip system messages from errors etc.)
  const chatMsgs = allMessages.filter(m => m.role === 'user' || m.role === 'assistant');

  if (chatMsgs.length === 0) return apiMessages;

  // Short conversation: include everything
  if (chatMsgs.length <= 10) {
    let budget = MAX_HISTORY_TOKENS;
    for (const m of chatMsgs) {
      const cost = estimateTokens(m.content);
      if (cost > budget) break;
      apiMessages.push({ role: m.role, content: m.content });
      budget -= cost;
    }
    return apiMessages;
  }

  // Long conversation: first 2 + separator + last 8
  let budget = MAX_HISTORY_TOKENS;
  const first2 = chatMsgs.slice(0, 2);
  const last8 = chatMsgs.slice(-8);

  for (const m of first2) {
    const cost = estimateTokens(m.content);
    if (cost > budget) break;
    apiMessages.push({ role: m.role, content: m.content });
    budget -= cost;
  }

  // Separator so the model knows there's a gap
  apiMessages.push({
    role: 'system',
    content: '(... ముందటి సంభాషణ ఇక్కడ తొలగించబడింది ...)',
  });
  budget -= 20; // small cost for separator

  for (const m of last8) {
    const cost = estimateTokens(m.content);
    if (cost > budget) break;
    apiMessages.push({ role: m.role, content: m.content });
    budget -= cost;
  }

  return apiMessages;
}

// ---------------------------------------------------------------------------
// Relative Time Helper (for conversation history sidebar)
// ---------------------------------------------------------------------------

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ఇప్పుడే';
  if (mins < 60) return `${mins} ని. క్రితం`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} గం. క్రితం`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'నిన్న';
  if (days < 7) return `${days} రోజుల క్రితం`;
  return new Date(ts).toLocaleDateString('te-IN', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// SSE Streaming
// ---------------------------------------------------------------------------

let abortController: AbortController | null = null;

export function abortCurrentStream(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export async function sendMessage(
  text: string,
  activeScreen: string = 'home',
  imageUrl?: string,
  displayText?: string,
): Promise<ChatAction[]> {
  const convId = ensureActiveConversation();

  // Add user message — displayContent is the clean text for UI, content is the full text for AI
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}_u`,
    role: 'user',
    content: text,
    displayContent: displayText || undefined,
    timestamp: Date.now(),
    imageUrl,
  };
  addMessage(convId, userMsg);

  // Prepare AI call
  const config = loadConfig();
  if (!config.apiKey) {
    const errMsg: ChatMessage = {
      id: `msg_${Date.now()}_e`,
      role: 'system',
      content: 'Sarvam API key needed — Settings లో నమోదు చేయండి.',
      timestamp: Date.now(),
    };
    addMessage(convId, errMsg);
    return [];
  }

  chatState.set('thinking');

  // Use the full context-aware system prompt (includes memories, live data, screen context)
  const systemPrompt = buildCurrentSystemPrompt();

  // Build smart message history for API (context window management)
  const conv = get(conversations).find(c => c.id === convId);
  const apiMsgs = buildMessagesForAPI(conv?.messages ?? [], systemPrompt);

  // Add placeholder assistant message for streaming
  const assistantMsg: ChatMessage = {
    id: `msg_${Date.now()}_a`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    streaming: true,
  };
  addMessage(convId, assistantMsg);

  abortController = new AbortController();

  // 30-second timeout to prevent infinite hanging
  const timeoutId = setTimeout(() => {
    console.warn('[chat] Request timed out after 30s, aborting');
    abortController?.abort();
  }, 30_000);

  try {
    console.log('[chat] Sending to Sarvam', config.chatModel, '- messages:', apiMsgs.length);
    console.log('[chat] User text:', text.slice(0, 80) + (text.length > 80 ? '...' : ''));

    const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': config.apiKey,
      },
      signal: abortController.signal,
      body: JSON.stringify({
        model: config.chatModel,
        messages: apiMsgs,
        temperature: 0.7,
        max_tokens: 800,
        stream: true,
      }),
    });

    console.log('[chat] Response status:', response.status);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[chat] Error response:', response.status, errText);

      // User-friendly Telugu error messages by status code
      let userError: string;
      if (response.status === 429) {
        userError = '⚠️ చాలా requests వచ్చాయి. కొద్దిసేపు ఆగి మళ్ళీ ప్రయత్నించండి.';
      } else if (response.status === 401 || response.status === 403) {
        userError = '⚠️ API key సరిగ్గా లేదు. Settings లో చెక్ చేయండి.';
      } else if (response.status >= 500) {
        userError = '⚠️ Sarvam సర్వర్ లో సమస్య ఉంది. కొద్దిసేపు తర్వాత మళ్ళీ ప్రయత్నించండి.';
      } else {
        userError = `⚠️ క్షమించండి, సమస్య ఉంది (${response.status}). మళ్ళీ ప్రయత్నించండి.`;
      }
      replaceLastAssistantContent(convId, userError);
      finalizeAssistantMessage(convId);
      chatState.set('idle');
      return [];
    }

    // Guard against null response body
    if (!response.body) {
      console.error('[chat] Response body is null');
      replaceLastAssistantContent(convId, '⚠️ సర్వర్ నుండి ప్రతిస్పందన లేదు. మళ్ళీ ప్రయత్నించండి.');
      finalizeAssistantMessage(convId);
      chatState.set('idle');
      return [];
    }

    chatState.set('responding');

    // SSE stream reading
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';      // Raw content including <think> tags
    let displayedLength = 0;   // How much cleaned content we've shown so far

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') break;
          if (!data) continue;

          try {
            const chunk = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              // Strip <think> tags for display (handles partial blocks during streaming)
              const cleaned = stripPartialThinkTag(fullContent);
              const newText = cleaned.slice(displayedLength);
              if (newText) {
                // Replace full assistant message content with cleaned version
                replaceLastAssistantContent(convId, cleaned);
                displayedLength = cleaned.length;
              }
            }
          } catch {
            // Malformed SSE chunk — skip
          }
        }
      }
    } catch (streamErr) {
      console.error('[chat] Stream read error:', streamErr);
      // If we got partial content, keep it. Otherwise show error.
      if (fullContent.trim().length === 0) {
        replaceLastAssistantContent(convId, '⚠️ కనెక్షన్ తెగిపోయింది. మళ్ళీ ప్రయత్నించండి.');
        finalizeAssistantMessage(convId);
        chatState.set('idle');
        return [];
      }
      // Fall through to finalize with whatever content we received
    }

    // Final strip: remove any remaining <think> blocks from complete response
    const cleanedFinal = stripThinkTags(fullContent);
    console.log('[chat] Streaming complete: raw=%d chars, cleaned=%d chars', fullContent.length, cleanedFinal.length);

    // Guard against empty response (stream succeeded but AI returned nothing useful)
    if (cleanedFinal.trim().length === 0) {
      console.warn('[chat] Empty response after think-strip. Raw content was:', fullContent.slice(0, 200));
      replaceLastAssistantContent(
        convId,
        '🤔 నాకు సరైన సమాధానం చెప్పలేకపోతున్నాను. దయచేసి మళ్ళీ అడగండి.',
      );
      finalizeAssistantMessage(convId);
      chatState.set('idle');
      return [];
    }

    // Extract actions from clean response BEFORE stripping for display
    const actions = extractActions(cleanedFinal);

    // Strip action JSON from displayed content (user shouldn't see raw JSON)
    const displayContent = actions.length > 0
      ? stripActionFromContent(cleanedFinal)
      : cleanedFinal;

    // Set the final clean content on the assistant message
    replaceLastAssistantContent(convId, displayContent);
    finalizeAssistantMessage(convId);
    chatState.set('idle');
    console.log('[chat] Response displayed: %d chars, actions: %d', displayContent.length, actions.length);

    if (actions.length > 0) {
      setAssistantAction(convId, actions[0]);
      chatState.set('confirming');
      return actions;
    }

    // FALLBACK: If AI didn't generate an action block, check if user's
    // original message had a record intent using client-side Telugu parser
    const fallbackParsed = detectRecordIntent(text);
    if (fallbackParsed) {
      console.log('[chat] Fallback intent detected:', fallbackParsed.kind, fallbackParsed.amount_paise);
      const fallbackAction = generateFallbackAction(fallbackParsed);
      setAssistantAction(convId, fallbackAction);
      chatState.set('confirming');
      return [fallbackAction];
    }

    return actions;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Distinguish user-abort from timeout-abort
      const wasTimeout = !abortController || abortController.signal.aborted;
      console.warn('[chat] Aborted:', wasTimeout ? 'timeout' : 'user');
      if (wasTimeout) {
        replaceLastAssistantContent(convId, '⚠️ సమయం ముగిసింది. మళ్ళీ ప్రయత్నించండి.');
      }
      finalizeAssistantMessage(convId);
      chatState.set('idle');
      return [];
    }

    // On error, show Telugu error in the assistant bubble (not appended)
    const errorText = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat] sendMessage error:', errorText);
    replaceLastAssistantContent(convId, `⚠️ క్షమించండి, సమస్య ఉంది. మళ్ళీ ప్రయత్నించండి.\n(${errorText})`);
    finalizeAssistantMessage(convId);
    chatState.set('idle');
    return [];
  } finally {
    clearTimeout(timeoutId);
    abortController = null;
  }
}

// ---------------------------------------------------------------------------
// Voice Input
// ---------------------------------------------------------------------------

export async function sendVoice(audioBlob: Blob, activeScreen: string = 'home'): Promise<ChatAction[]> {
  chatState.set('transcribing');

  try {
    if (!hasApiKey()) {
      chatState.set('idle');
      // Add system message about missing key
      const convId = ensureActiveConversation();
      addMessage(convId, {
        id: `msg_${Date.now()}_e`,
        role: 'system',
        content: 'STT API key needed — Settings లో Sarvam key నమోదు చేయండి.',
        timestamp: Date.now(),
      });
      return [];
    }

    const result = await transcribeAudio(audioBlob);
    const transcript = result.transcript.trim();

    if (!transcript) {
      chatState.set('idle');
      const convId = ensureActiveConversation();
      addMessage(convId, {
        id: `msg_${Date.now()}_e`,
        role: 'system',
        content: 'ఆడియో గుర్తించలేకపోయింది. మళ్ళీ చెప్పండి.',
        timestamp: Date.now(),
      });
      return [];
    }

    return await sendMessage(transcript, activeScreen);
  } catch (err) {
    chatState.set('idle');
    const convId = ensureActiveConversation();
    const errorText = err instanceof Error ? err.message : 'STT failed';
    addMessage(convId, {
      id: `msg_${Date.now()}_e`,
      role: 'system',
      content: `⚠️ ${errorText}`,
      timestamp: Date.now(),
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Get last message preview for collapsed bar
// ---------------------------------------------------------------------------

export function getLastMessagePreview(): string {
  const conv = get(activeConversation);
  if (!conv || conv.messages.length === 0) return '';
  const last = conv.messages[conv.messages.length - 1];
  const cleaned = stripThinkTags(last.content);
  const preview = cleaned.slice(0, 50);
  return preview + (cleaned.length > 50 ? '...' : '');
}
