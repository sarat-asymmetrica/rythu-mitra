<script lang="ts">
  /**
   * SearchResults.svelte — Display multi-provider search results in chat.
   *
   * Renders a compact card list of SearchResult[] with:
   *   - Source badge (knowledge base, DuckDuckGo, Google, Sarvam AI)
   *   - Title + snippet in Telugu
   *   - Clickable URL (opens in browser/new tab)
   *   - Matti design system colours (earth palette)
   */

  import type { SearchResult, SearchProvider } from '../lib/search';

  interface Props {
    results: SearchResult[];
    query?: string;
  }

  let { results, query = '' }: Props = $props();

  function sourceLabel(source: SearchProvider): string {
    switch (source) {
      case 'cached': return '📚 జ్ఞాన భండారం';
      case 'duckduckgo': return '🔍 వెబ్ సెర్చ్';
      case 'google': return '🔍 Google';
      case 'sarvam': return '🧠 AI జ్ఞానం';
      default: return '🔍 సెర్చ్';
    }
  }

  function sourceBadgeClass(source: SearchProvider): string {
    switch (source) {
      case 'cached': return 'badge-kb';
      case 'duckduckgo': return 'badge-ddg';
      case 'google': return 'badge-google';
      case 'sarvam': return 'badge-sarvam';
      default: return 'badge-ddg';
    }
  }

  function handleLinkClick(url: string, e: MouseEvent) {
    if (!url) {
      e.preventDefault();
      return;
    }
    // Tauri / Neutralino: open in default browser
    // For plain web: just let the link open in a new tab
  }
</script>

{#if results.length > 0}
  <div class="search-results" role="list" aria-label="సెర్చ్ ఫలితాలు">
    {#if query}
      <div class="search-header">
        <span class="search-query">"{query}"</span>
        <span class="result-count">{results.length} ఫలితాలు</span>
      </div>
    {/if}

    {#each results as result, i (i)}
      <div class="result-card" role="listitem">
        <!-- Source badge -->
        <div class="result-meta">
          <span class="source-badge {sourceBadgeClass(result.source)}">
            {sourceLabel(result.source)}
          </span>
        </div>

        <!-- Title -->
        {#if result.title && result.title !== query}
          <div class="result-title">{result.title}</div>
        {/if}

        <!-- Snippet -->
        <div class="result-snippet">{result.snippet}</div>

        <!-- URL (only if meaningful) -->
        {#if result.url}
          <a
            href={result.url}
            class="result-url"
            target="_blank"
            rel="noopener noreferrer"
            onclick={(e) => handleLinkClick(result.url, e)}
          >
            {result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .search-results {
    display: flex;
    flex-direction: column;
    gap: var(--space-8, 8px);
    margin-top: var(--space-5, 5px);
    width: 100%;
  }

  .search-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 2px;
  }

  .search-query {
    font-size: var(--text-xs, 12px);
    color: var(--ink-secondary, #4a3728);
    font-family: var(--font-te, 'Noto Sans Telugu', sans-serif);
    font-style: italic;
  }

  .result-count {
    font-size: var(--text-xs, 12px);
    color: var(--ink-tertiary, #7a6657);
    font-family: var(--font-mono, 'Courier Prime', monospace);
  }

  .result-card {
    background: var(--patti-warm, #f5f0e8);
    border-radius: var(--radius-card, 12px);
    padding: var(--space-13, 13px);
    border: 1px solid var(--nalupurugu-soft, #d4c9b8);
    border-left: 3px solid var(--matti, #8B4513);
    display: flex;
    flex-direction: column;
    gap: var(--space-5, 5px);
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: var(--space-5, 5px);
  }

  .source-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    font-family: var(--font-te, 'Noto Sans Telugu', sans-serif);
  }

  /* Knowledge Base — earthy amber */
  .badge-kb {
    background: rgba(232, 163, 23, 0.15);
    color: var(--pasupu, #E8A317);
    border: 1px solid rgba(232, 163, 23, 0.3);
  }

  /* DuckDuckGo — calm blue */
  .badge-ddg {
    background: rgba(27, 79, 114, 0.12);
    color: var(--neeli, #1B4F72);
    border: 1px solid rgba(27, 79, 114, 0.25);
  }

  /* Google — standard */
  .badge-google {
    background: rgba(27, 79, 114, 0.12);
    color: var(--neeli, #1B4F72);
    border: 1px solid rgba(27, 79, 114, 0.25);
  }

  /* Sarvam AI — green (knowledge) */
  .badge-sarvam {
    background: rgba(45, 106, 79, 0.12);
    color: var(--pacchi, #2d6a4f);
    border: 1px solid rgba(45, 106, 79, 0.25);
  }

  .result-title {
    font-family: var(--font-te, 'Noto Sans Telugu', sans-serif);
    font-size: var(--text-sm, 14px);
    font-weight: 600;
    color: var(--ink-primary, #1c1c1c);
    line-height: 1.4;
  }

  .result-snippet {
    font-family: var(--font-te, 'Noto Sans Telugu', sans-serif);
    font-size: var(--text-sm, 14px);
    color: var(--ink-secondary, #4a3728);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .result-url {
    font-family: var(--font-mono, 'Courier Prime', monospace);
    font-size: 11px;
    color: var(--neeli, #1B4F72);
    text-decoration: none;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
    transition: opacity 150ms ease;
  }

  .result-url:hover {
    opacity: 1;
    text-decoration: underline;
  }
</style>
