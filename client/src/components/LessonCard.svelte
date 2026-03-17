<script lang="ts">
  import type { Lesson } from '../lib/curriculum';
  import { markLessonComplete, getCompletedLessons } from '../lib/curriculum';

  interface Props {
    lesson: Lesson;
    oncomplete?: () => void;
  }

  let { lesson, oncomplete }: Props = $props();

  // State
  let expanded = $state(false);
  let quizAnswered = $state(false);
  let selectedOption = $state<number | null>(null);
  let completedIds = $state(getCompletedLessons());

  let isComplete = $derived(completedIds.includes(lesson.id));

  const difficultyLabel: Record<Lesson['difficulty'], string> = {
    beginner: 'సులభం',
    intermediate: 'మధ్యస్థం',
    advanced: 'కష్టం',
  };

  const difficultyColor: Record<Lesson['difficulty'], string> = {
    beginner: 'var(--pacchi, #27ae60)',
    intermediate: 'var(--pasupu, #E8A317)',
    advanced: 'var(--erra, #c0392b)',
  };

  function toggle() {
    expanded = !expanded;
  }

  function handleQuiz(optionIndex: number) {
    if (quizAnswered) return;
    selectedOption = optionIndex;
    quizAnswered = true;
  }

  function handleComplete() {
    markLessonComplete(lesson.id);
    completedIds = getCompletedLessons();
    expanded = false;
    oncomplete?.();
  }

  // Simple markdown renderer: bold, lists, headings (Telugu content)
  function renderMarkdown(text: string): string {
    return text
      // H2/H3 headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Unordered list items
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Table rows (simple)
      .replace(/^\|(.+)\|$/gm, (_, cells) => {
        const tds = cells.split('|').map((c: string) => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      })
      .replace(/^(\|-+)+\|$/gm, '') // table separator
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/(<li>.*?<\/li>(\n|$))+/gs, (match) => `<ul>${match}</ul>`)
      // Wrap consecutive <tr> in <table>
      .replace(/(<tr>.*?<\/tr>(\n|$))+/gs, (match) => `<table class="lesson-table">${match}</table>`)
      // Paragraphs (double newline)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines inside paragraphs
      .replace(/\n/g, '<br>');
  }
</script>

<article
  class="lesson-card"
  class:complete={isComplete}
  class:expanded
>
  <!-- Card Header (always visible) -->
  <button class="card-header" onclick={toggle} aria-expanded={expanded}>
    <span class="lesson-icon" aria-hidden="true">{lesson.icon}</span>
    <div class="card-meta">
      <div class="card-title">
        <span class="title-te">{lesson.title}</span>
        {#if isComplete}
          <span class="complete-badge" aria-label="పూర్తయింది">✓</span>
        {/if}
      </div>
      <div class="card-subtitle">{lesson.titleEn}</div>
      <div class="card-tags">
        <span class="tag duration">⏱ {lesson.duration}</span>
        <span
          class="tag difficulty"
          style="color: {difficultyColor[lesson.difficulty]}; border-color: {difficultyColor[lesson.difficulty]};"
        >
          {difficultyLabel[lesson.difficulty]}
        </span>
      </div>
    </div>
    <span class="chevron" class:rotated={expanded} aria-hidden="true">›</span>
  </button>

  <!-- Expanded Content -->
  {#if expanded}
    <div class="card-body">
      <div class="lesson-content">
          <p>{@html renderMarkdown(lesson.content)}</p>
      </div>

      <!-- Quiz (if present) -->
      {#if lesson.quiz}
        <div class="quiz-section">
          <div class="quiz-label">📝 త్వరిత పరీక్ష</div>
          <p class="quiz-question">{lesson.quiz.question}</p>
          <div class="quiz-options">
            {#each lesson.quiz.options as option, i}
              <button
                class="quiz-option"
                class:selected={selectedOption === i}
                class:correct={quizAnswered && i === lesson.quiz.correctIndex}
                class:wrong={quizAnswered && selectedOption === i && i !== lesson.quiz.correctIndex}
                onclick={() => handleQuiz(i)}
                disabled={quizAnswered}
              >
                {option}
              </button>
            {/each}
          </div>
          {#if quizAnswered}
            <div
              class="quiz-explanation"
              class:correct-bg={selectedOption === lesson.quiz.correctIndex}
              class:wrong-bg={selectedOption !== lesson.quiz.correctIndex}
            >
              {selectedOption === lesson.quiz.correctIndex ? '✓ సరైన జవాబు! ' : '✗ తప్పు జవాబు. '}
              {lesson.quiz.explanation}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Actions -->
      <div class="card-actions">
        {#if !isComplete}
          <button class="btn-complete" onclick={handleComplete}>
            ✓ పూర్తయింది
          </button>
        {:else}
          <div class="already-complete">✓ చదివారు</div>
        {/if}
        <button class="btn-collapse" onclick={toggle}>← తిరిగి</button>
      </div>
    </div>
  {/if}
</article>

<style>
  .lesson-card {
    background: var(--patti, #1e1e22);
    border: 1px solid var(--nalupurugu, rgba(255,255,255,0.08));
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .lesson-card.complete {
    opacity: 0.65;
    border-color: var(--pacchi, #27ae60);
  }

  .lesson-card.expanded {
    border-color: var(--matti, #8B4513);
  }

  .card-header {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 14px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .lesson-icon {
    font-size: 28px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .card-meta {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }

  .title-te {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-primary, #d4d0c8);
    line-height: 1.4;
  }

  .complete-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: var(--pacchi, #27ae60);
    color: white;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .card-subtitle {
    font-size: 11px;
    color: var(--ink-tertiary, #888);
    margin-bottom: 6px;
  }

  .card-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tag {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 500;
  }

  .tag.duration {
    background: rgba(255,255,255,0.06);
    color: var(--ink-secondary, #aaa);
  }

  .tag.difficulty {
    background: transparent;
    border: 1px solid;
    font-weight: 600;
  }

  .chevron {
    font-size: 20px;
    color: var(--ink-tertiary, #888);
    transition: transform 0.2s ease;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 4px;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  /* ── Expanded body ── */
  .card-body {
    padding: 0 14px 16px;
    border-top: 1px solid var(--nalupurugu, rgba(255,255,255,0.06));
  }

  .lesson-content {
    color: var(--ink-secondary, #bbb);
    font-size: 13px;
    line-height: 1.7;
    padding-top: 12px;
  }

  .lesson-content :global(h2) {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-primary, #d4d0c8);
    margin: 14px 0 8px;
  }

  .lesson-content :global(h3) {
    font-size: 13px;
    font-weight: 700;
    color: var(--pasupu, #E8A317);
    margin: 12px 0 6px;
  }

  .lesson-content :global(strong) {
    color: var(--ink-primary, #d4d0c8);
    font-weight: 600;
  }

  .lesson-content :global(ul) {
    padding-left: 20px;
    margin: 6px 0;
  }

  .lesson-content :global(li) {
    margin-bottom: 4px;
  }

  .lesson-content :global(.lesson-table) {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 12px;
  }

  .lesson-content :global(.lesson-table td) {
    padding: 5px 8px;
    border: 1px solid var(--nalupurugu, rgba(255,255,255,0.1));
    vertical-align: top;
  }

  .lesson-content :global(.lesson-table tr:first-child td) {
    background: rgba(255,255,255,0.04);
    font-weight: 600;
    color: var(--ink-primary, #d4d0c8);
  }

  /* ── Quiz ── */
  .quiz-section {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--nalupurugu, rgba(255,255,255,0.06));
  }

  .quiz-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-tertiary, #888);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 8px;
  }

  .quiz-question {
    font-size: 13px;
    color: var(--ink-primary, #d4d0c8);
    margin-bottom: 10px;
    font-weight: 500;
  }

  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .quiz-option {
    padding: 9px 12px;
    border: 1px solid var(--nalupurugu, rgba(255,255,255,0.1));
    border-radius: 8px;
    background: rgba(255,255,255,0.03);
    color: var(--ink-secondary, #bbb);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .quiz-option:not(:disabled):hover {
    background: rgba(255,255,255,0.07);
    border-color: var(--matti, #8B4513);
  }

  .quiz-option:disabled {
    cursor: default;
  }

  .quiz-option.correct {
    background: rgba(39, 174, 96, 0.15);
    border-color: var(--pacchi, #27ae60);
    color: var(--pacchi, #27ae60);
  }

  .quiz-option.wrong {
    background: rgba(192, 57, 43, 0.15);
    border-color: var(--erra, #c0392b);
    color: var(--erra, #c0392b);
  }

  .quiz-explanation {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.6;
  }

  .quiz-explanation.correct-bg {
    background: rgba(39, 174, 96, 0.1);
    color: var(--pacchi, #27ae60);
  }

  .quiz-explanation.wrong-bg {
    background: rgba(192, 57, 43, 0.1);
    color: var(--erra, #c0392b);
  }

  /* ── Actions ── */
  .card-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    align-items: center;
  }

  .btn-complete {
    flex: 1;
    padding: 11px 16px;
    background: var(--matti, #8B4513);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-complete:active {
    opacity: 0.8;
  }

  .btn-collapse {
    padding: 11px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--nalupurugu, rgba(255,255,255,0.1));
    border-radius: 10px;
    color: var(--ink-secondary, #bbb);
    font-size: 13px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .already-complete {
    flex: 1;
    padding: 11px 16px;
    text-align: center;
    color: var(--pacchi, #27ae60);
    font-size: 14px;
    font-weight: 600;
    background: rgba(39, 174, 96, 0.1);
    border-radius: 10px;
  }
</style>
