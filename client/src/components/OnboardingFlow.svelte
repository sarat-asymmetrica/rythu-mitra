<script lang="ts">
  import { onMount } from 'svelte';
  import { getConnection } from '../lib/db';
  import { saveConfig, loadConfig, testSarvamKey } from '../lib/sarvam';

  interface Props {
    oncomplete: () => void;
  }

  let { oncomplete }: Props = $props();

  // ---------------------------------------------------------------------------
  // Step state
  // ---------------------------------------------------------------------------
  type Step = 0 | 1 | 2 | 3 | 4 | 5;
  let step = $state<Step>(0);

  // ---------------------------------------------------------------------------
  // Collected data
  // ---------------------------------------------------------------------------
  let language = $state<'te' | 'en'>('te');
  let name = $state('');
  let village = $state('');
  let district = $state('అనంతపురం');
  let selectedCrops = $state<string[]>([]);
  let customCrop = $state('');
  let acres = $state<number | null>(null);
  let apiKey = $state('');
  let testingKey = $state(false);
  let keyValid = $state<boolean | null>(null);

  // ---------------------------------------------------------------------------
  // Telugu / English strings
  // ---------------------------------------------------------------------------
  const T = $derived(language === 'te' ? TE : EN);

  const TE = {
    welcome: 'నమస్తే! రైతు మిత్ర కి స్వాగతం!',
    welcomeSub: 'మీ వ్యవసాయ సహాయకుడు',
    step1Q: 'మీ పేరు ఏమిటి?',
    step1P: 'మీ పేరు ఇక్కడ టైప్ చేయండి',
    step2Q1: 'మీరు ఎక్కడ నుండి?',
    step2P1: 'గ్రామం పేరు',
    step2P2: 'జిల్లా ఎంచుకోండి',
    step3Q: 'ఏ పంటలు పండిస్తున్నారు?',
    step3Q2: 'ఎంత భూమి ఉంది?',
    step3Unit: 'ఎకరాలు',
    step3Other: 'మరొక పంట...',
    step4Q: 'AI ఫీచర్లు ఎనేబుల్ చేయాలంటే Sarvam API key కావాలి.',
    step4Sub: 'ఇప్పుడు స్కిప్ చేసి తర్వాత Settings లో add చేయవచ్చు.',
    step4P: 'sk_... (api.sarvam.ai నుండి)',
    step4Test: 'Key పరీక్షించు',
    step4Skip: 'ఇప్పుడు వద్దు',
    step5Title: 'రెడీ!',
    step5Sub: 'మీ రైతు మిత్ర account తయారు!',
    step5Btn: 'ప్రారంభించు',
    next: 'తదుపరి',
    back: 'వెనక్కి',
    nameRequired: 'పేరు అవసరం',
    villageRequired: 'గ్రామం పేరు అవసరం',
    cropRequired: 'కనీసం ఒక పంట ఎంచుకోండి',
    testing: 'పరీక్షిస్తున్నాం...',
    keyOk: 'Key సరిగ్గా ఉంది!',
    keyBad: 'Key తప్పు — Settings లో మార్చవచ్చు',
  };

  const EN = {
    welcome: 'Welcome to Rythu Mitra!',
    welcomeSub: 'Your farming companion',
    step1Q: 'What is your name?',
    step1P: 'Type your name here',
    step2Q1: 'Where are you from?',
    step2P1: 'Village name',
    step2P2: 'Select district',
    step3Q: 'What crops do you grow?',
    step3Q2: 'How much land do you have?',
    step3Unit: 'acres',
    step3Other: 'Other crop...',
    step4Q: 'Add your Sarvam API key to enable AI features.',
    step4Sub: 'You can skip this now and add it later in Settings.',
    step4P: 'sk_... (from api.sarvam.ai)',
    step4Test: 'Test Key',
    step4Skip: 'Skip for now',
    step5Title: 'Ready!',
    step5Sub: 'Your Rythu Mitra account is set up!',
    step5Btn: 'Start Using App',
    next: 'Next',
    back: 'Back',
    nameRequired: 'Name is required',
    villageRequired: 'Village name is required',
    cropRequired: 'Please select at least one crop',
    testing: 'Testing...',
    keyOk: 'Key is valid!',
    keyBad: 'Invalid key — you can change it in Settings',
  };

  // ---------------------------------------------------------------------------
  // Districts
  // ---------------------------------------------------------------------------
  const DISTRICTS = [
    'అనంతపురం', 'కర్నూలు', 'గుంతూరు', 'కృష్ణా', 'నెల్లూరు',
    'ప్రకాశం', 'శ్రీకాకుళం', 'విశాఖపట్నం', 'విజయనగరం', 'పశ్చిమ గోదావరి',
    'తూర్పు గోదావరి', 'వైఎస్ఆర్ కడప', 'చిత్తూరు', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు',
  ];

  // ---------------------------------------------------------------------------
  // Common crop chips
  // ---------------------------------------------------------------------------
  const CROPS = [
    'వేరుశెనగ', 'పత్తి', 'మొక్కజొన్న', 'వరి',
    'మిర్చి', 'టమాటా', 'వేసవి పత్తి', 'పసుపు',
  ];

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  let validationMsg = $state('');

  function validate(): boolean {
    validationMsg = '';
    if (step === 1) {
      if (!name.trim()) { validationMsg = T.nameRequired; return false; }
    }
    if (step === 2) {
      if (!village.trim()) { validationMsg = T.villageRequired; return false; }
    }
    if (step === 3) {
      if (selectedCrops.length === 0 && !customCrop.trim()) {
        validationMsg = T.cropRequired; return false;
      }
    }
    return true;
  }

  function nextStep() {
    if (!validate()) return;
    if (step < 5) step = (step + 1) as Step;
  }

  function prevStep() {
    validationMsg = '';
    if (step > 0) step = (step - 1) as Step;
  }

  // ---------------------------------------------------------------------------
  // Crop chip toggle
  // ---------------------------------------------------------------------------
  function toggleCrop(crop: string) {
    if (selectedCrops.includes(crop)) {
      selectedCrops = selectedCrops.filter(c => c !== crop);
    } else {
      selectedCrops = [...selectedCrops, crop];
    }
    validationMsg = '';
  }

  // ---------------------------------------------------------------------------
  // API key test
  // ---------------------------------------------------------------------------
  async function handleTestKey() {
    if (!apiKey.trim()) return;
    testingKey = true;
    keyValid = null;
    try {
      keyValid = await testSarvamKey(apiKey.trim());
    } catch {
      keyValid = false;
    } finally {
      testingKey = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Complete onboarding
  // ---------------------------------------------------------------------------
  function handleComplete() {
    const allCrops = [
      ...selectedCrops,
      ...(customCrop.trim() ? [customCrop.trim()] : []),
    ];

    const conn = getConnection();
    if (conn) {
      // Register farmer
      try {
        conn.reducers.registerFarmer({
          name: name.trim(),
          phone: '',
          village: village.trim(),
          district,
          language,
        });
      } catch (err) {
        console.warn('[onboarding] registerFarmer failed:', err);
      }

      // Wait briefly for registration to propagate, then set context
      setTimeout(() => {
        try {
          if (conn) {
            conn.reducers.updateFarmerContext({
              crops: JSON.stringify(allCrops),
              acres: acres ?? 0,
              plots: '[]',
              irrigationType: '',
              seasonStage: '',
              painPoints: '',
              rawStoryJson: '{}',
            });
          }
        } catch (err) {
          console.warn('[onboarding] updateFarmerContext failed:', err);
        }
      }, 800);
    } else {
      console.warn('[onboarding] No STDB connection yet — farmer will be registered on next sync');
    }

    // Save Sarvam API key if provided
    if (apiKey.trim()) {
      const cfg = loadConfig();
      cfg.apiKey = apiKey.trim();
      saveConfig(cfg);
    }

    // Mark onboarding complete
    localStorage.setItem('rythu_mitra_onboarded', 'true');
    localStorage.setItem('rythu_mitra_farmer_name', name.trim());
    localStorage.setItem('rythu_mitra_farmer_village', village.trim());
    localStorage.setItem('rythu_mitra_farmer_district', district);
    localStorage.setItem('rythu_mitra_farmer_language', language);
    localStorage.setItem('rythu_mitra_farmer_crops', JSON.stringify(allCrops));
    localStorage.setItem('rythu_mitra_farmer_acres', String(acres ?? 0));

    oncomplete();
  }

  // ---------------------------------------------------------------------------
  // Progress dots
  // ---------------------------------------------------------------------------
  const TOTAL_STEPS = 6; // Steps 0..5

  onMount(() => {
    // Pre-fill name from any previously-saved data (e.g. partial onboarding)
    const saved = localStorage.getItem('rythu_mitra_farmer_name');
    if (saved) name = saved;
  });
</script>

<!-- Full-screen onboarding overlay -->
<div class="onboarding-overlay" role="dialog" aria-modal="true" aria-label="onboarding">
  <!-- Progress dots -->
  <div class="progress-dots" aria-label="step {step + 1} of {TOTAL_STEPS}">
    {#each Array(TOTAL_STEPS) as _, i}
      <span class="dot" class:active={i === step} class:done={i < step}></span>
    {/each}
  </div>

  <!-- Step container -->
  <div class="step-wrap">

    <!-- ── Step 0: Welcome + Language ── -->
    {#if step === 0}
      <div class="step-content" style="animation: stepIn var(--dur-377) var(--spring) both;">
        <div class="welcome-icon" aria-hidden="true">🌾</div>
        <h1 class="step-title welcome-title">{TE.welcome}</h1>
        <p class="step-sub">{TE.welcomeSub}</p>

        <div class="lang-buttons">
          <button
            class="lang-btn"
            class:selected={language === 'te'}
            onclick={() => { language = 'te'; }}
          >
            <span class="lang-flag">🇮🇳</span>
            <span class="lang-label">తెలుగు</span>
          </button>
          <button
            class="lang-btn"
            class:selected={language === 'en'}
            onclick={() => { language = 'en'; }}
          >
            <span class="lang-flag">🔤</span>
            <span class="lang-label">English</span>
          </button>
        </div>

        <button class="primary-btn" onclick={nextStep}>
          {T.next} →
        </button>
      </div>

    <!-- ── Step 1: Name ── -->
    {:else if step === 1}
      <div class="step-content" style="animation: stepIn var(--dur-377) var(--spring) both;">
        <div class="step-icon" aria-hidden="true">🙏</div>
        <h2 class="step-title">{T.step1Q}</h2>

        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="big-input"
          type="text"
          placeholder={T.step1P}
          bind:value={name}
          autofocus
          onkeydown={(e) => e.key === 'Enter' && nextStep()}
          aria-label="farmer name"
        />

        {#if validationMsg}
          <p class="validation-msg">{validationMsg}</p>
        {/if}

        <div class="nav-row">
          <button class="ghost-btn" onclick={prevStep}>{T.back}</button>
          <button class="primary-btn" onclick={nextStep}>{T.next} →</button>
        </div>
      </div>

    <!-- ── Step 2: Location ── -->
    {:else if step === 2}
      <div class="step-content" style="animation: stepIn var(--dur-377) var(--spring) both;">
        <div class="step-icon" aria-hidden="true">📍</div>
        <h2 class="step-title">
          {name.trim() ? `${name.trim()} గారు, ` : ''}{T.step2Q1}
        </h2>

        <input
          class="big-input"
          type="text"
          placeholder={T.step2P1}
          bind:value={village}
          onkeydown={(e) => e.key === 'Enter' && nextStep()}
          aria-label="village name"
        />

        <select
          class="big-select"
          bind:value={district}
          aria-label="district"
        >
          {#each DISTRICTS as d}
            <option value={d}>{d}</option>
          {/each}
        </select>

        {#if validationMsg}
          <p class="validation-msg">{validationMsg}</p>
        {/if}

        <div class="nav-row">
          <button class="ghost-btn" onclick={prevStep}>{T.back}</button>
          <button class="primary-btn" onclick={nextStep}>{T.next} →</button>
        </div>
      </div>

    <!-- ── Step 3: Crops + Land ── -->
    {:else if step === 3}
      <div class="step-content" style="animation: stepIn var(--dur-377) var(--spring) both;">
        <div class="step-icon" aria-hidden="true">🌱</div>
        <h2 class="step-title">{T.step3Q}</h2>

        <div class="crop-chips">
          {#each CROPS as crop}
            <button
              class="crop-chip"
              class:selected={selectedCrops.includes(crop)}
              onclick={() => toggleCrop(crop)}
              aria-pressed={selectedCrops.includes(crop)}
            >
              {crop}
            </button>
          {/each}
        </div>

        <input
          class="medium-input"
          type="text"
          placeholder={T.step3Other}
          bind:value={customCrop}
          aria-label="custom crop"
        />

        <div class="land-row">
          <span class="land-label">{T.step3Q2}</span>
          <input
            class="acres-input"
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            bind:value={acres}
            aria-label="land in acres"
          />
          <span class="land-unit">{T.step3Unit}</span>
        </div>

        {#if validationMsg}
          <p class="validation-msg">{validationMsg}</p>
        {/if}

        <div class="nav-row">
          <button class="ghost-btn" onclick={prevStep}>{T.back}</button>
          <button class="primary-btn" onclick={nextStep}>{T.next} →</button>
        </div>
      </div>

    <!-- ── Step 4: Sarvam API Key ── -->
    {:else if step === 4}
      <div class="step-content" style="animation: stepIn var(--dur-377) var(--spring) both;">
        <div class="step-icon" aria-hidden="true">🤖</div>
        <h2 class="step-title">{T.step4Q}</h2>
        <p class="step-sub">{T.step4Sub}</p>

        <input
          class="big-input key-input"
          type="password"
          placeholder={T.step4P}
          bind:value={apiKey}
          autocomplete="off"
          spellcheck={false}
          aria-label="Sarvam API key"
        />

        <div class="key-actions">
          <button
            class="test-btn"
            onclick={handleTestKey}
            disabled={testingKey || !apiKey.trim()}
          >
            {testingKey ? T.testing : T.step4Test}
          </button>

          {#if keyValid === true}
            <span class="key-status valid">✓ {T.keyOk}</span>
          {:else if keyValid === false}
            <span class="key-status invalid">✗ {T.keyBad}</span>
          {/if}
        </div>

        <div class="nav-row">
          <button class="ghost-btn" onclick={prevStep}>{T.back}</button>
          <button class="skip-btn" onclick={nextStep}>{T.step4Skip}</button>
          {#if apiKey.trim()}
            <button class="primary-btn" onclick={nextStep}>{T.next} →</button>
          {/if}
        </div>
      </div>

    <!-- ── Step 5: Done! ── -->
    {:else if step === 5}
      <div class="step-content done-step" style="animation: stepIn var(--dur-377) var(--spring) both;">
        <div class="done-icon" aria-hidden="true">🎉</div>
        <h2 class="step-title done-title">
          {T.step5Title}{name.trim() ? `, ${name.trim()} గారు!` : '!'}
        </h2>
        <p class="step-sub">{T.step5Sub}</p>

        {#if selectedCrops.length > 0 || customCrop.trim()}
          <div class="summary-chips">
            {#each [...selectedCrops, ...(customCrop.trim() ? [customCrop.trim()] : [])] as crop}
              <span class="summary-chip">{crop}</span>
            {/each}
          </div>
        {/if}

        <div class="summary-row">
          <span class="summary-item">📍 {village.trim() || '—'}, {district}</span>
          {#if acres}
            <span class="summary-item">🌾 {acres} {T.step3Unit}</span>
          {/if}
        </div>

        <button class="start-btn" onclick={handleComplete}>
          🌾 {T.step5Btn}
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 300);
    background: var(--patti, #1a1612);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: env(safe-area-inset-top, 0) 0 env(safe-area-inset-bottom, 0);
    overflow: hidden;
  }

  /* Progress dots */
  .progress-dots {
    display: flex;
    gap: 8px;
    padding: 20px 0 8px;
    flex-shrink: 0;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--nalupurugu, #4a3f35);
    transition: background var(--dur-377) ease, transform var(--dur-233) ease;
  }

  .dot.active {
    background: var(--pasupu, #e8a317);
    transform: scale(1.25);
  }

  .dot.done {
    background: var(--pacchi, #2d6a4f);
  }

  /* Step container — centres content vertically */
  .step-wrap {
    flex: 1;
    width: 100%;
    max-width: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-21, 20px);
    overflow-y: auto;
  }

  .step-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-13, 12px);
    padding: var(--space-21, 20px) 0;
  }

  @keyframes stepIn {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Welcome step */
  .welcome-icon {
    font-size: 72px;
    margin-bottom: var(--space-8, 8px);
    animation: sprout 0.6s var(--spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
  }

  @keyframes sprout {
    from { transform: scale(0) rotate(-20deg); opacity: 0; }
    to { transform: scale(1) rotate(0deg); opacity: 1; }
  }

  .welcome-title {
    font-size: var(--text-2xl, 1.5rem);
    text-align: center;
  }

  /* Step icons */
  .step-icon {
    font-size: 48px;
    margin-bottom: var(--space-5, 4px);
  }

  /* Titles */
  .step-title {
    font-family: var(--font-te-display, serif);
    font-size: var(--text-xl, 1.25rem);
    color: var(--ink-primary, #d4d0c8);
    font-weight: 600;
    text-align: center;
    line-height: 1.4;
    margin: 0;
  }

  .step-sub {
    font-size: var(--text-sm, 0.875rem);
    color: var(--ink-tertiary, #7a6f65);
    text-align: center;
    max-width: 300px;
    line-height: 1.5;
    margin: 0;
  }

  /* Language buttons */
  .lang-buttons {
    display: flex;
    gap: var(--space-13, 12px);
    margin: var(--space-8, 8px) 0;
  }

  .lang-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5, 4px);
    padding: var(--space-13, 12px) var(--space-21, 20px);
    border-radius: var(--radius-card, 12px);
    border: 2px solid var(--nalupurugu, #4a3f35);
    background: var(--patti-warm, #201a15);
    color: var(--ink-secondary, #b8a99a);
    font-family: var(--font-te, serif);
    font-size: var(--text-base, 1rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--dur-233) var(--spring, ease);
    min-width: 120px;
  }

  .lang-btn:hover {
    border-color: var(--pasupu, #e8a317);
  }

  .lang-btn.selected {
    border-color: var(--pasupu, #e8a317);
    background: var(--pasupu-glow, rgba(232, 163, 23, 0.1));
    color: var(--ink-primary, #d4d0c8);
  }

  .lang-flag { font-size: 24px; }
  .lang-label { font-size: var(--text-sm, 0.875rem); }

  /* Inputs */
  .big-input {
    width: 100%;
    padding: var(--space-13, 12px) var(--space-13, 12px);
    border: 2px solid var(--nalupurugu, #4a3f35);
    border-radius: var(--radius-card, 12px);
    background: var(--patti-warm, #201a15);
    color: var(--ink-primary, #d4d0c8);
    font-family: var(--font-te, serif);
    font-size: var(--text-xl, 1.25rem);
    outline: none;
    transition: border-color var(--dur-233) ease;
    text-align: center;
  }

  .big-input:focus {
    border-color: var(--pasupu, #e8a317);
  }

  .big-input.key-input {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-base, 1rem);
    text-align: left;
    letter-spacing: 1px;
  }

  .medium-input {
    width: 100%;
    padding: var(--space-8, 8px) var(--space-13, 12px);
    border: 1px solid var(--nalupurugu, #4a3f35);
    border-radius: var(--radius-card-sm, 8px);
    background: var(--patti-warm, #201a15);
    color: var(--ink-primary, #d4d0c8);
    font-family: var(--font-te, serif);
    font-size: var(--text-sm, 0.875rem);
    outline: none;
    transition: border-color var(--dur-233) ease;
  }

  .medium-input:focus {
    border-color: var(--pasupu, #e8a317);
  }

  .big-select {
    width: 100%;
    padding: var(--space-13, 12px);
    border: 2px solid var(--nalupurugu, #4a3f35);
    border-radius: var(--radius-card, 12px);
    background: var(--patti-warm, #201a15);
    color: var(--ink-primary, #d4d0c8);
    font-family: var(--font-te, serif);
    font-size: var(--text-base, 1rem);
    outline: none;
    cursor: pointer;
    appearance: auto;
  }

  .big-select:focus {
    border-color: var(--pasupu, #e8a317);
  }

  /* Crop chips */
  .crop-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8, 8px);
    justify-content: center;
    width: 100%;
  }

  .crop-chip {
    padding: var(--space-8, 8px) var(--space-13, 12px);
    border-radius: var(--radius-pill, 999px);
    border: 2px solid var(--nalupurugu, #4a3f35);
    background: var(--patti-warm, #201a15);
    color: var(--ink-secondary, #b8a99a);
    font-family: var(--font-te, serif);
    font-size: var(--text-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--dur-233) var(--spring, ease);
    min-height: 40px;
  }

  .crop-chip:hover {
    border-color: var(--pasupu, #e8a317);
  }

  .crop-chip.selected {
    border-color: var(--matti, #8b4513);
    background: rgba(139, 69, 19, 0.2);
    color: var(--ink-primary, #d4d0c8);
    font-weight: 600;
  }

  /* Land row */
  .land-row {
    display: flex;
    align-items: center;
    gap: var(--space-8, 8px);
    width: 100%;
    padding: var(--space-8, 8px) 0;
  }

  .land-label {
    flex: 1;
    font-family: var(--font-te, serif);
    font-size: var(--text-sm, 0.875rem);
    color: var(--ink-secondary, #b8a99a);
  }

  .acres-input {
    width: 80px;
    padding: var(--space-5, 4px) var(--space-8, 8px);
    border: 1px solid var(--nalupurugu, #4a3f35);
    border-radius: var(--radius-card-sm, 8px);
    background: var(--patti-warm, #201a15);
    color: var(--ink-primary, #d4d0c8);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-base, 1rem);
    text-align: center;
    outline: none;
  }

  .acres-input:focus {
    border-color: var(--pasupu, #e8a317);
  }

  .land-unit {
    font-family: var(--font-te, serif);
    font-size: var(--text-sm, 0.875rem);
    color: var(--ink-tertiary, #7a6f65);
  }

  /* Key actions */
  .key-actions {
    display: flex;
    align-items: center;
    gap: var(--space-8, 8px);
    width: 100%;
    flex-wrap: wrap;
  }

  .test-btn {
    padding: var(--space-5, 4px) var(--space-13, 12px);
    background: var(--neeli, #1b4f72);
    color: var(--ink-on-dark, #fff);
    border-radius: var(--radius-card-sm, 8px);
    font-family: var(--font-te, serif);
    font-size: var(--text-xs, 0.75rem);
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--dur-233) ease;
    min-height: 36px;
  }

  .test-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .key-status {
    font-size: var(--text-xs, 0.75rem);
    font-weight: 600;
  }

  .key-status.valid { color: var(--pacchi, #2d6a4f); }
  .key-status.invalid { color: var(--erra, #c0392b); }

  /* Validation message */
  .validation-msg {
    font-size: var(--text-xs, 0.75rem);
    color: var(--erra, #c0392b);
    text-align: center;
    margin: 0;
  }

  /* Navigation rows */
  .nav-row {
    display: flex;
    align-items: center;
    gap: var(--space-8, 8px);
    width: 100%;
    margin-top: var(--space-8, 8px);
    justify-content: flex-end;
  }

  /* Buttons */
  .primary-btn {
    padding: var(--space-13, 12px) var(--space-21, 20px);
    background: var(--matti, #8b4513);
    color: var(--ink-on-dark, #fff);
    border-radius: var(--radius-card, 12px);
    font-family: var(--font-te, serif);
    font-size: var(--text-base, 1rem);
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
    transition: transform var(--dur-233) var(--spring, ease), box-shadow var(--dur-233) ease;
    box-shadow: 0 2px 8px rgba(139, 69, 19, 0.4);
  }

  .primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 13px rgba(139, 69, 19, 0.5);
  }

  .primary-btn:active {
    transform: scale(0.97);
  }

  .ghost-btn {
    padding: var(--space-8, 8px) var(--space-13, 12px);
    background: transparent;
    color: var(--ink-tertiary, #7a6f65);
    border: 1px solid var(--nalupurugu, #4a3f35);
    border-radius: var(--radius-card, 12px);
    font-family: var(--font-te, serif);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
    min-height: 44px;
    transition: color var(--dur-233) ease;
  }

  .ghost-btn:hover {
    color: var(--ink-secondary, #b8a99a);
  }

  .skip-btn {
    padding: var(--space-8, 8px) var(--space-13, 12px);
    background: transparent;
    color: var(--ink-tertiary, #7a6f65);
    border: none;
    font-family: var(--font-te, serif);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    min-height: 44px;
  }

  .skip-btn:hover {
    color: var(--ink-secondary, #b8a99a);
  }

  /* Done step */
  .done-step {
    gap: var(--space-8, 8px);
  }

  .done-icon {
    font-size: 64px;
    animation: celebrate 0.6s var(--spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
  }

  @keyframes celebrate {
    0% { transform: scale(0) rotate(-30deg); }
    60% { transform: scale(1.2) rotate(10deg); }
    100% { transform: scale(1) rotate(0deg); }
  }

  .done-title {
    font-size: var(--text-2xl, 1.5rem);
  }

  .summary-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5, 4px);
    justify-content: center;
    margin-top: var(--space-5, 4px);
  }

  .summary-chip {
    padding: var(--space-3, 3px) var(--space-8, 8px);
    background: rgba(139, 69, 19, 0.15);
    border: 1px solid var(--matti, #8b4513);
    border-radius: var(--radius-pill, 999px);
    color: var(--ink-primary, #d4d0c8);
    font-family: var(--font-te, serif);
    font-size: var(--text-xs, 0.75rem);
  }

  .summary-row {
    display: flex;
    gap: var(--space-13, 12px);
    flex-wrap: wrap;
    justify-content: center;
  }

  .summary-item {
    font-size: var(--text-sm, 0.875rem);
    color: var(--ink-secondary, #b8a99a);
    font-family: var(--font-te, serif);
  }

  .start-btn {
    width: 100%;
    max-width: 300px;
    padding: var(--space-21, 20px);
    background: var(--pacchi, #2d6a4f);
    color: var(--patti, #1a1612);
    border-radius: var(--radius-card, 12px);
    font-family: var(--font-te-display, serif);
    font-size: var(--text-lg, 1.125rem);
    font-weight: 700;
    cursor: pointer;
    margin-top: var(--space-13, 12px);
    transition: transform var(--dur-233) var(--spring, ease), box-shadow var(--dur-233) ease;
    box-shadow: 0 4px 16px rgba(45, 106, 79, 0.4);
  }

  .start-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 21px rgba(45, 106, 79, 0.5);
  }

  .start-btn:active {
    transform: scale(0.97);
  }
</style>
