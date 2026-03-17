<script lang="ts">
  import type { ChatMessage } from '../lib/chat';
  import SearchResults from './SearchResults.svelte';
  import type { SearchResult } from '../lib/search';

  interface Props {
    message: ChatMessage;
  }

  let { message }: Props = $props();

  /** Extract SearchResult[] from action data if this is a web_search response. */
  function getSearchResults(): SearchResult[] | null {
    if (message.action?.action !== 'web_search') return null;
    const data = message.action?.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    // Validate that the first item looks like a SearchResult (has snippet + source)
    const first = data[0] as Record<string, unknown>;
    if (typeof first.snippet !== 'string' || typeof first.source !== 'string') return null;
    return data as SearchResult[];
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // Get the display-ready content for a message
  function getDisplayContent(): string {
    // For user messages with a photo: prefer displayContent (clean, no OCR metadata)
    if (message.displayContent) {
      return message.displayContent;
    }
    // Otherwise: clean the content of metadata
    return cleanContent(message.content);
  }

  // Strip action JSON, <think> blocks, and OCR metadata from display content
  function cleanContent(content: string): string {
    let cleaned = content;
    // Strip <think>...</think> reasoning traces (safety net — should already be stripped in chat.ts)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
    // Strip incomplete <think> blocks (streaming edge case)
    cleaned = cleaned.replace(/<think>[\s\S]*$/g, '');
    // Strip action JSON blocks (bare or fenced)
    cleaned = cleaned.replace(/```(?:json)?\s*\{"action"\s*:[\s\S]*?\}\s*```/g, '');
    cleaned = cleaned.replace(/\{"action"\s*:\s*"[^"]*?"[^}]*\}/g, '');
    // Strip OCR metadata sections (shown as image context, not raw text)
    cleaned = cleaned.replace(/\n*\[OCR extracted text:[\s\S]*?\]/g, '');
    cleaned = cleaned.replace(/\n*\[Amounts found:[\s\S]*?\]/g, '');
    cleaned = cleaned.replace(/\n*\[Products:[\s\S]*?\]/g, '');
    cleaned = cleaned.replace(/\n*\[Dates:[\s\S]*?\]/g, '');
    // Strip the 📸 prefix that ChatInput adds
    cleaned = cleaned.replace(/^📸\s*/, '');
    return cleaned.trim();
  }

  /**
   * Simple markdown-to-HTML renderer.
   * Supports: **bold**, *italic*, `code`, ### headings, - bullets, 1. numbered lists.
   * Telugu text + markdown coexist correctly (regex operates on markers, not content).
   */
  function renderMarkdown(text: string): string {
    // Sanitize: strip dangerous HTML tags (XSS protection for {@html})
    let html = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/onerror\s*=/gi, 'data-blocked=')
      .replace(/onload\s*=/gi, 'data-blocked=');

    // Code (inline): `code` -> <code>code</code>  (do first to protect from other transforms)
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Bold: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* -> <em>text</em>  (not matching ** which is already consumed)
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

    // Headings: ### text -> <h3>, ## text -> <h2>
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // Lists: consecutive "- item" lines -> <ul><li>...</li></ul>
    html = html.replace(/(^- .+$(\n- .+$)*)/gm, (block) => {
      const items = block.split('\n').map(line =>
        `<li>${line.replace(/^- /, '')}</li>`
      ).join('');
      return `<ul>${items}</ul>`;
    });

    // Numbered lists: consecutive "N. item" lines -> <ol><li>...</li></ol>
    html = html.replace(/(^\d+\. .+$(\n\d+\. .+$)*)/gm, (block) => {
      const items = block.split('\n').map(line =>
        `<li>${line.replace(/^\d+\. /, '')}</li>`
      ).join('');
      return `<ol>${items}</ol>`;
    });

    // Paragraphs: double newlines -> paragraph breaks
    html = html.replace(/\n\n+/g, '</p><p>');
    // Single newlines -> line breaks (but not inside list/heading tags)
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph tags
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs and paragraphs wrapping block elements
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<(?:ul|ol|h[23])>)/g, '$1');
    html = html.replace(/(<\/(?:ul|ol|h[23])>)\s*<\/p>/g, '$1');

    return html;
  }

  function displayContent(content: string): string {
    return renderMarkdown(cleanContent(content));
  }
</script>

{#if message.role === 'system'}
  <div class="chat-msg system">
    <span class="system-text">{message.content}</span>
  </div>
{:else if message.role === 'user'}
  <div class="chat-msg user">
    <div class="bubble user-bubble">
      {#if message.imageUrl}
        <div class="msg-image-wrap">
          <img src={message.imageUrl} alt="bill attachment" class="msg-image" />
        </div>
      {/if}
      <p class="msg-text">{getDisplayContent()}</p>
      <span class="msg-time">{formatTime(message.timestamp)}</span>
    </div>
  </div>
{:else}
  <div class="chat-msg assistant">
    <div class="bubble assistant-bubble">
      <div class="msg-content">
        {@html displayContent(message.content)}
      </div>
      {#if getSearchResults()}
        <SearchResults results={getSearchResults()!} query={String(message.action?.query ?? '')} />
      {/if}
      {#if message.streaming}
        <span class="cursor-blink" aria-hidden="true"></span>
      {/if}
      <span class="msg-time">{formatTime(message.timestamp)}</span>
    </div>
  </div>
{/if}

<style>
  .chat-msg {
    display: flex;
    margin-bottom: var(--space-8);
    animation: fadeUp var(--dur-233) var(--ease-out) both;
  }

  .chat-msg.user {
    justify-content: flex-end;
  }

  .chat-msg.assistant {
    justify-content: flex-start;
  }

  .chat-msg.system {
    justify-content: center;
  }

  .bubble {
    max-width: 85%;
    padding: var(--space-8) var(--space-13);
    position: relative;
    word-break: break-word;
  }

  .user-bubble {
    background: var(--matti);
    color: white;
    border-radius: 13px 3px 13px 13px;
  }

  .assistant-bubble {
    background: var(--patti-warm);
    color: var(--ink-primary);
    border-radius: 3px 13px 13px 13px;
    border-left: 3px solid var(--pacchi);
  }

  .system-text {
    font-size: var(--text-xs);
    color: var(--ink-tertiary);
    text-align: center;
    padding: var(--space-3) var(--space-8);
  }

  .msg-image-wrap {
    margin-bottom: var(--space-5);
  }

  .msg-image {
    max-width: 200px;
    max-height: 160px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    object-fit: cover;
  }

  .msg-text {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Markdown rendered content */
  .msg-content {
    font-family: var(--font-te);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .msg-content :global(p) {
    margin: 0 0 4px;
  }

  .msg-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .msg-content :global(strong) {
    font-weight: 600;
    color: var(--ink-primary);
  }

  .msg-content :global(em) {
    font-style: italic;
  }

  .msg-content :global(h2) {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink-primary);
    margin: 8px 0 5px;
  }

  .msg-content :global(h3) {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink-primary);
    margin: 8px 0 3px;
  }

  .msg-content :global(ul) {
    padding-left: 21px;
    margin: 5px 0;
    list-style-type: disc;
  }

  .msg-content :global(ol) {
    padding-left: 21px;
    margin: 5px 0;
  }

  .msg-content :global(li) {
    margin-bottom: 3px;
  }

  .msg-content :global(li::marker) {
    color: var(--matti);
  }

  .msg-content :global(code) {
    background: var(--patti-warm);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .msg-content :global(br + br) {
    display: none; /* Collapse excessive line breaks */
  }

  .msg-time {
    display: block;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--ink-faint);
    text-align: right;
    margin-top: var(--space-3);
  }

  .user-bubble .msg-time {
    color: rgba(255, 255, 255, 0.6);
  }

  /* Streaming cursor */
  .cursor-blink {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: var(--pasupu);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: cursorPulse var(--dur-987) ease-in-out infinite;
  }

  @keyframes cursorPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
</style>
