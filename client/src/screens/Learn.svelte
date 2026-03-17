<script lang="ts">
  import { myFarmerContext } from '../lib/stores';
  import {
    CURRICULUM,
    getLessonsByCategory,
    getRecommendedLessons,
    getLessonProgress,
    getCompletedLessons,
    type Lesson,
  } from '../lib/curriculum';
  import LessonCard from '../components/LessonCard.svelte';

  // ── State ──
  let refreshKey = $state(0);  // increment to re-read localStorage

  // ── Derived from farmer context ──
  let crops = $derived.by(() => {
    const ctx = $myFarmerContext;
    if (!ctx) return ['వేరుశెనగ', 'పత్తి'];
    try {
      const parsed: string[] = JSON.parse(ctx.crops || '[]');
      return parsed.length > 0 ? parsed : ['వేరుశెనగ', 'పత్తి'];
    } catch {
      return ['వేరుశెనగ', 'పత్తి'];
    }
  });

  let district = $derived.by(() => {
    const ctx = $myFarmerContext;
    return ctx?.district ?? 'anantapur';
  });

  // ── Progress (refreshes when a lesson is completed) ──
  let progress = $derived.by(() => {
    void refreshKey; // reactive dependency
    return getLessonProgress();
  });

  let completedIds = $derived.by(() => {
    void refreshKey;
    return getCompletedLessons();
  });

  // ── Recommended lessons ──
  let recommended = $derived(getRecommendedLessons(crops, district, completedIds));

  // ── Category data ──
  const categories: Array<{
    key: Lesson['category'];
    label: string;
    labelEn: string;
    icon: string;
  }> = [
    { key: 'farming',  label: 'వ్యవసాయం',    labelEn: 'Farming',  icon: '🌾' },
    { key: 'finance',  label: 'ఆర్థికం',      labelEn: 'Finance',  icon: '💰' },
    { key: 'schemes',  label: 'పథకాలు',       labelEn: 'Schemes',  icon: '🏛️' },
    { key: 'market',   label: 'మార్కెట్',     labelEn: 'Market',   icon: '📊' },
    { key: 'health',   label: 'ఆరోగ్యం',      labelEn: 'Health',   icon: '❤️' },
  ];

  function onLessonComplete() {
    refreshKey += 1; // trigger re-read of localStorage
  }

  // Progress bar width
  let progressBarWidth = $derived(`${progress.percent}%`);
</script>

<main class="learn-screen">
  <!-- Page title -->
  <header class="learn-header">
    <div class="header-title">
      <span class="header-icon">📚</span>
      <div>
        <h1>నేర్చుకోండి</h1>
        <p class="header-sub">Learn</p>
      </div>
    </div>
  </header>

  <!-- Progress bar -->
  <section class="progress-section">
    <div class="progress-meta">
      <span class="progress-label">మీ పురోగతి</span>
      <span class="progress-count">{progress.completed}/{progress.total} పూర్తయింది</span>
    </div>
    <div class="progress-bar-track">
      <div
        class="progress-bar-fill"
        style="width: {progressBarWidth}"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      ></div>
    </div>
    {#if progress.percent >= 100}
      <p class="progress-congrats">అద్భుతం! మీరు అన్ని పాఠాలు పూర్తి చేశారు! 🎉</p>
    {:else if progress.percent >= 50}
      <p class="progress-note">చాలా మంచిది! మరికొంత చదివితే పూర్తవుతుంది.</p>
    {:else if progress.percent > 0}
      <p class="progress-note">మంచి ప్రారంభం! ప్రతి రోజు ఒక పాఠం చదవండి.</p>
    {:else}
      <p class="progress-note">{CURRICULUM.length} పాఠాలు మీ కోసం సిద్ధంగా ఉన్నాయి.</p>
    {/if}
  </section>

  <!-- Recommended section -->
  {#if recommended.length > 0}
    <section class="lessons-section">
      <div class="section-header">
        <span class="section-icon">⭐</span>
        <div>
          <h2 class="section-title">మీ కోసం</h2>
          <p class="section-sub">Recommended for You</p>
        </div>
      </div>
      <div class="lesson-list">
        {#each recommended as lesson (lesson.id)}
          <LessonCard {lesson} oncomplete={onLessonComplete} />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Category sections -->
  {#each categories as cat}
    {@const lessons = getLessonsByCategory(cat.key)}
    <section class="lessons-section">
      <div class="section-header">
        <span class="section-icon">{cat.icon}</span>
        <div>
          <h2 class="section-title">{cat.label}</h2>
          <p class="section-sub">{cat.labelEn}</p>
        </div>
        <span class="section-count">
          {lessons.filter(l => completedIds.includes(l.id)).length}/{lessons.length}
        </span>
      </div>
      <div class="lesson-list">
        {#each lessons as lesson (lesson.id)}
          <LessonCard {lesson} oncomplete={onLessonComplete} />
        {/each}
      </div>
    </section>
  {/each}

  <!-- Footer padding -->
  <div style="height: 24px"></div>
</main>

<style>
  .learn-screen {
    padding: 16px 16px 0;
    max-width: 420px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .learn-header {
    padding-top: 40px;
    margin-bottom: 16px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 36px;
  }

  h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink-primary, #d4d0c8);
    margin: 0;
    line-height: 1.2;
  }

  .header-sub {
    font-size: 12px;
    color: var(--ink-tertiary, #888);
    margin: 2px 0 0;
  }

  /* ── Progress ── */
  .progress-section {
    background: var(--patti, #1e1e22);
    border: 1px solid var(--nalupurugu, rgba(255,255,255,0.08));
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 20px;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .progress-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-secondary, #aaa);
  }

  .progress-count {
    font-size: 12px;
    color: var(--matti, #8B4513);
    font-weight: 700;
  }

  .progress-bar-track {
    height: 8px;
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--matti, #8B4513), var(--pasupu, #E8A317));
    border-radius: 4px;
    transition: width 0.5s ease;
  }

  .progress-note,
  .progress-congrats {
    font-size: 11px;
    color: var(--ink-tertiary, #888);
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .progress-congrats {
    color: var(--pacchi, #27ae60);
    font-weight: 500;
  }

  /* ── Section ── */
  .lessons-section {
    margin-bottom: 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .section-icon {
    font-size: 22px;
    flex-shrink: 0;
  }

  .section-header > div {
    flex: 1;
  }

  h2.section-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-primary, #d4d0c8);
    margin: 0;
    line-height: 1.3;
  }

  .section-sub {
    font-size: 10px;
    color: var(--ink-tertiary, #888);
    margin: 1px 0 0;
  }

  .section-count {
    font-size: 11px;
    color: var(--ink-tertiary, #888);
    background: rgba(255,255,255,0.06);
    padding: 2px 8px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  /* ── Lesson list ── */
  .lesson-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
