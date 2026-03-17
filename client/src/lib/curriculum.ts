/**
 * Rythu Mitra — Learn Mode Curriculum Engine (F012)
 *
 * Offline-first embedded curriculum: 20 lessons across 5 categories.
 * All content in Telugu, targeting AP/Telangana farmers.
 * Personalization by crop and district. Progress in localStorage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Lesson {
  id: string;
  category: 'farming' | 'finance' | 'schemes' | 'market' | 'health';
  title: string;      // Telugu title
  titleEn: string;    // English fallback
  icon: string;       // Emoji
  duration: string;   // "3 నిమిషాలు"
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: string;    // Telugu markdown content
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  tags: string[];          // ['groundnut', 'pest', 'anantapur']
  relatedLessons: string[]; // IDs of related lessons
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

const PROGRESS_KEY = 'rythu_mitra_learning_progress';

export function getCompletedLessons(): string[] {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function markLessonComplete(lessonId: string): void {
  const completed = getCompletedLessons();
  if (!completed.includes(lessonId)) {
    completed.push(lessonId);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed));
  }
}

export function getLessonProgress(): { completed: number; total: number; percent: number } {
  const completed = getCompletedLessons().length;
  const total = CURRICULUM.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

// ---------------------------------------------------------------------------
// Curriculum (20 lessons, 5 categories)
// ---------------------------------------------------------------------------

export const CURRICULUM: Lesson[] = [
  // ──────────────────────────────────────────────────────────────────
  // Category 1: Farming Best Practices (వ్యవసాయ పద్ధతులు)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'farm-001',
    category: 'farming',
    title: 'వేరుశెనగ సాగు — మొదటి అడుగులు',
    titleEn: 'Groundnut Cultivation Basics',
    icon: '🥜',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## వేరుశెనగ సాగు — మొదటి అడుగులు

**విత్తు సమయం:** జూన్ 15 – జూలై 15 (ఖరీఫ్), అక్టోబర్ 15 – నవంబర్ 15 (రబీ).

**మంచి రకాలు (అనంతపురం):**
- TG-26 (Kadiri-6) — అత్యంత జనాదరణ, 110-115 రోజులు
- K-134 — కరువు తట్టుకుంటుంది, 100-105 రోజులు
- Girnar-4 — అధిక దిగుబడి, 120 రోజులు

**విత్తు రేటు:** ఎకరాకు 80-100 కిలోలు విత్తనం అవసరం.

**నేల తయారీ:**
1. రెండు సార్లు దుక్కి దున్నండి
2. 5 టన్నుల వేప పిండి/FYM వేయండి
3. pH 6.0–7.0 మధ్య ఉండేలా చూడండి

**ముఖ్యమైన టిప్:** విత్తు ముందు Rhizobium + PSB treatment చేస్తే nitrogen fixation 20% పెరుగుతుంది. ₹50 పెట్టుబడికి ₹500 లాభం!`,
    quiz: {
      question: 'వేరుశెనగకు ఎకరాకు ఎంత విత్తనం అవసరం?',
      options: ['20-30 కిలోలు', '50-60 కిలోలు', '80-100 కిలోలు', '150 కిలోలు'],
      correctIndex: 2,
      explanation: 'వేరుశెనగకు ఎకరాకు 80-100 కిలోలు విత్తనం అవసరం. తక్కువ వేస్తే దిగుబడి తగ్గుతుంది.',
    },
    tags: ['groundnut', 'sowing', 'seeds', 'anantapur', 'kharif', 'rabi'],
    relatedLessons: ['farm-002', 'farm-004'],
  },

  {
    id: 'farm-002',
    category: 'farming',
    title: 'పత్తిలో తెల్లదోమ నివారణ',
    titleEn: 'Whitefly Control in Cotton',
    icon: '🌿',
    duration: '4 నిమిషాలు',
    difficulty: 'intermediate',
    content: `## పత్తిలో తెల్లదోమ నివారణ

తెల్లదోమ పత్తి ఆకుల అడుగు భాగంలో రసం పీలుస్తుంది. ఆకులు పసుపు పడతాయి, పంట 30-40% నష్టపోతుంది.

**గుర్తింపు:**
- ఆకులు వాసిన వెంట్రుకలు లాంటి తెల్లటి మలం కనపడతాయి
- ఆకు కింద తెల్లటి చిన్న పురుగులు గుంపులుగా ఉంటాయి

**నివారణ చర్యలు:**

1. **నీమ్ ఆయిల్ (ముందు జాగ్రత్త):** 5 ml/లీటర్ నీటికి + 1 ml డిటర్జెంట్. 15 రోజులకు ఒకసారి.
2. **పసుపు అట్టె ట్రాప్స్:** ఎకరాకు 10-12 పెట్టండి — సంఖ్య తగ్గిపోతే తెలుస్తుంది.
3. **తీవ్రమైతే:** ఫ్లోనికామిడ్ 0.5 g/లీ లేదా స్పిరోమెసిఫెన్ 1 ml/లీ.

**ముఖ్య హెచ్చరిక:** ఒకే పురుగుమందు పదే పదే వాడకండి — 3-4 వారాలలో రెసిస్టెన్స్ వస్తుంది. రకరకాల మందులు మార్చి వాడండి.

**ఖర్చు:** ఎకరాకు ₹200-400 (నీమ్ ఆయిల్ + ట్రాప్స్).`,
    quiz: {
      question: 'తెల్లదోమ నివారణకు నీమ్ ఆయిల్ ఎంత వేయాలి?',
      options: ['1 ml/లీటర్', '5 ml/లీటర్', '20 ml/లీటర్', '50 ml/లీటర్'],
      correctIndex: 1,
      explanation: 'నీమ్ ఆయిల్ 5 ml/లీటర్ నీటికి + 1 ml డిటర్జెంట్ కలిపి వాడండి. ఎక్కువ వేస్తే మొక్కకు నష్టం.',
    },
    tags: ['cotton', 'pest', 'whitefly', 'spray'],
    relatedLessons: ['farm-003', 'health-001'],
  },

  {
    id: 'farm-003',
    category: 'farming',
    title: 'సమగ్ర సస్య రక్షణ (IPM)',
    titleEn: 'Integrated Pest Management',
    icon: '🐛',
    duration: '5 నిమిషాలు',
    difficulty: 'intermediate',
    content: `## సమగ్ర సస్య రక్షణ (IPM)

IPM అంటే రసాయనాలు మాత్రమే కాదు — అన్ని పద్ధతులు కలిపి వాడటం.

**IPM 4 స్తంభాలు:**

### 1. నివారణ (Prevention)
- నిరోధక రకాలు వేయండి (BT Cotton, disease-resistant groundnut)
- పంట మార్పిడి చేయండి — ఒకే పంట వేయకండి
- సరైన విత్తు సమయం పాటించండి

### 2. సాంస్కృతిక పద్ధతులు
- పొలం చుట్టూ వేపమండలు పెట్టండి
- పురుగులు తొందరగా గుర్తించడానికి ట్రాప్ crops (బెండ, ఆవాలు) వేయండి

### 3. జీవ నియంత్రణ
- Trichogramma cards (egg parasitoid) — ₹60/card, ఎకరాకు 3-4 cards
- NPV virus (Bollworm కోసం) — ₹80-100/acre

### 4. రసాయన నియంత్రణ (చివరి ఆప్షన్)
- Economic Threshold Level (ETL) దాటినప్పుడే వాడండి
- సెలక్టివ్ పురుగుమందులు వాడండి (broad-spectrum వద్దు)

**ఆదాయం:** IPM పాటించే రైతులు ₹2,000-5,000/ఎకరా ఆదా చేస్తున్నారు.`,
    tags: ['pest', 'ipm', 'organic', 'cotton', 'groundnut'],
    relatedLessons: ['farm-002', 'health-001'],
  },

  {
    id: 'farm-004',
    category: 'farming',
    title: 'నేల పరీక్ష ఎందుకు ముఖ్యం?',
    titleEn: 'Why Soil Testing Matters',
    icon: '🌱',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## నేల పరీక్ష ఎందుకు ముఖ్యం?

చాలా మంది రైతులు అనుభవం మేరకు ఎరువులు వేస్తారు. కానీ నేల పరీక్ష చేయించుకుంటే సరైన మొత్తంలో వేయవచ్చు.

**నేల పరీక్ష ఫలితాలు:**
- N (Nitrogen), P (Phosphorus), K (Potassium) స్థాయిలు
- pH విలువ (6.0-7.0 మంచిది)
- micronutrients (zinc, boron, sulphur)

**ఎక్కడ పంపాలి:**
- సమీప వ్యవసాయ విస్తరణ కార్యాలయం
- రైతు సేవా కేంద్రం
- ఖర్చు: ₹100-150/sample

**ఫలితం ఏం చెప్తుంది:**
| pH విలువ | అర్థం |
|---------|-------|
| 6.0-7.0 | అనువైన నేల |
| 7.5+ | చుణ్ణం అవసరం |
| 5.5- | సున్నం అవసరం |

**లాభం:** సరైన ఎరువు వేస్తే ఎకరాకు ₹500-1,000 ఆదా!

**కాడ్మియం / Heavy Metals:** ఒకే పొలంలో ఒకే ఎరువు వేసుకోవడం వల్ల soil degradation వస్తుంది. 3 సంవత్సరాలకు ఒకసారి పరీక్ష చేయించుకోండి.`,
    tags: ['soil', 'fertilizer', 'beginner', 'groundnut', 'cotton'],
    relatedLessons: ['farm-001', 'finance-002'],
  },

  {
    id: 'farm-005',
    category: 'farming',
    title: 'డ్రిప్ ఇరిగేషన్ — ₹25,000 పెట్టుబడి, 40% నీరు ఆదా',
    titleEn: 'Drip Irrigation — 40% Water Savings',
    icon: '💧',
    duration: '4 నిమిషాలు',
    difficulty: 'intermediate',
    content: `## డ్రిప్ ఇరిగేషన్

**ఖర్చు vs లాభం:**
- ఎకరాకు ఖర్చు: ₹25,000–35,000
- ప్రభుత్వ సబ్సిడీ: 50-90% (SC/ST రైతులకు 90%)
- మీ నికర ఖర్చు: ₹2,500–17,500 మాత్రమే!
- నీరు ఆదా: 40%
- దిగుబడి పెరుగుదల: 20-30%

**దరఖాస్తు ఎలా:**
1. PMKSY పోర్టల్: pmksy.gov.in
2. AP MIDH కార్యాలయం (జిల్లా హెడ్‌క్వార్టర్స్)
3. Documents: Patta, Adangal, Aadhaar, Bank passbook

**ఏ పంటలకు మంచిది:**
- వేరుశెనగ: 35-40% నీరు ఆదా
- పత్తి: 30% నీరు ఆదా
- కూరగాయలు: 45-50% నీరు ఆదా

**ఉదాహరణ:** 4 ఎకరాల వేరుశెనగ పొలంలో డ్రిప్ పెట్టిన రైతుకు సీజన్‌కు ₹8,000 డీజిల్ ఖర్చు తగ్గింది!`,
    quiz: {
      question: 'డ్రిప్ ఇరిగేషన్‌కు SC/ST రైతులకు సబ్సిడీ ఎంత?',
      options: ['25%', '50%', '75%', '90%'],
      correctIndex: 3,
      explanation: 'SC/ST రైతులకు PMKSY కింద 90% వరకు సబ్సిడీ అందుబాటులో ఉంది. దరఖాస్తు చేయండి!',
    },
    tags: ['irrigation', 'drip', 'water', 'subsidy', 'pmksy'],
    relatedLessons: ['schemes-001', 'farm-004'],
  },

  // ──────────────────────────────────────────────────────────────────
  // Category 2: Financial Literacy (ఆర్థిక అవగాహన)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'finance-001',
    category: 'finance',
    title: 'రోజువారీ ఖర్చుల నమోదు — ఎందుకు ముఖ్యం?',
    titleEn: 'Why Track Daily Farm Expenses',
    icon: '📝',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## రోజువారీ ఖర్చుల నమోదు

చాలా మంది రైతులు సీజన్ చివర్లో "ఎంత లాభం వచ్చిందో తెలియటం లేదు" అని చెప్తారు.

**ఎందుకు రాయాలి:**
- మీరు ఏ పనికి ఎంత ఖర్చు పెట్టారో తెలుసుకోవచ్చు
- తదుపరి సీజన్‌లో మెరుగ్గా ప్లాన్ చేయవచ్చు
- బ్యాంక్ రుణానికి దరఖాస్తు చేసేటప్పుడు పని వస్తుంది
- మోసాలు జరిగినా అది ప్రూఫ్‌గా ఉంటుంది

**ఏం రాయాలి:**
1. తేదీ
2. ఏ పని (కూలి / ఎరువు / మందు / రవాణా)
3. ఎంత ఖర్చు
4. ఎవరికి ఇచ్చారు

**రైతు మిత్ర అప్లికేషన్‌లో:**
మాట్లాడితే అప్లికేషన్ అర్థం చేసుకుంటుంది! "నిన్న రెండు కూలీలకు ₹800 ఇచ్చాను" అని చెప్పండి — రికార్డ్ అవుతుంది.

**ఒక నెల రాస్తే:** మీ పొలం లాభనష్టాల పూర్తి చిత్రం కనిపిస్తుంది.`,
    tags: ['records', 'expenses', 'financial', 'beginner'],
    relatedLessons: ['finance-002', 'finance-003'],
  },

  {
    id: 'finance-002',
    category: 'finance',
    title: 'సీజన్ ప్లానింగ్ — ముందే బడ్జెట్ వేయండి',
    titleEn: 'Season Budget Planning',
    icon: '📅',
    duration: '5 నిమిషాలు',
    difficulty: 'intermediate',
    content: `## సీజన్ బడ్జెట్ ప్లానింగ్

పంట వేయడానికి ముందే ఖర్చుల అంచనా వేయండి.

**4 ఎకరాల వేరుశెనగ — ఉదాహరణ బడ్జెట్:**

| ఖర్చు వస్తువు | ఒక ఎకరా | 4 ఎకరాలు |
|-------------|---------|---------|
| విత్తనాలు (90 kg) | ₹2,700 | ₹10,800 |
| ఎరువులు (DAP + యూరియా) | ₹1,500 | ₹6,000 |
| కూలి (సాగు + కోత) | ₹3,500 | ₹14,000 |
| పురుగుమందులు | ₹800 | ₹3,200 |
| నీటిపారుదల | ₹1,200 | ₹4,800 |
| రవాణా + ఇతర | ₹600 | ₹2,400 |
| **మొత్తం** | **₹10,300** | **₹41,200** |

**ఆదాయం అంచనా:**
- దిగుబడి: ఎకరాకు 8-12 క్వింటాళ్లు (కరువు ప్రాంతం)
- ధర: ₹5,500-6,000/quintal (MSP: ₹6,783)
- మొత్తం: ₹44,000-57,600

**నికర లాభం:** ₹2,800–16,400 (4 ఎకరాలకు)

**ముఖ్యమైన గుర్తింపు:** వర్షాలు తక్కువగా ఉంటే దిగుబడి తగ్గుతుంది. బీమా తప్పనిసరిగా తీసుకోండి!`,
    quiz: {
      question: '4 ఎకరాల వేరుశెనగకు సగటు మొత్తం ఖర్చు ఎంత?',
      options: ['₹10,000', '₹25,000', '₹41,200', '₹80,000'],
      correctIndex: 2,
      explanation: 'సగటున 4 ఎకరాలకు ₹41,200 ఖర్చవుతుంది. ఇది అంచనా మాత్రమే — జిల్లా బట్టి మారవచ్చు.',
    },
    tags: ['budget', 'planning', 'finance', 'season', 'groundnut'],
    relatedLessons: ['finance-001', 'finance-003'],
  },

  {
    id: 'finance-003',
    category: 'finance',
    title: 'అప్పు తీసుకునే ముందు ఆలోచించండి',
    titleEn: 'Think Before Borrowing',
    icon: '⚠️',
    duration: '4 నిమిషాలు',
    difficulty: 'beginner',
    content: `## అప్పు తీసుకునే ముందు ఆలోచించండి

**బ్యాంక్ రుణాలు vs మైక్రోఫైనాన్స్ vs వడ్డీ వ్యాపారులు:**

| రుణ రకం | వడ్డీ రేటు | గమనిక |
|--------|----------|-------|
| KCC (బ్యాంక్) | 4% | అత్యుత్తమం |
| NABARD/ Co-op | 7-9% | మంచిది |
| Microfinance | 18-24% | జాగ్రత్తగా |
| Private lender | 36-60% | అత్యంత ప్రమాదకరం |

**ఉదాహరణ:**
- ₹50,000 అప్పు, 24% వడ్డీ = సంవత్సరానికి ₹12,000 వడ్డీ
- ₹50,000 అప్పు, 4% KCC = సంవత్సరానికి ₹2,000 వడ్డీ
- తేడా: ₹10,000/సంవత్సరం!

**అప్పు అవసరమైతే — ఇలా చేయండి:**
1. ముందు KCC (కిసాన్ క్రెడిట్ కార్డ్) apply చేయండి
2. Cooperative bank లో అడగండి
3. NABARD linked schemes చూడండి
4. చివరగా మాత్రమే private lender దగ్గరకు వెళ్ళండి

**వడ్డీ వ్యాపారుల దగ్గర అప్పు మానుకోండి** — అది మీ కుటుంబాన్ని అప్పుల ఊబిలో ముంచుతుంది.`,
    tags: ['loan', 'debt', 'kcc', 'finance', 'warning'],
    relatedLessons: ['schemes-003', 'finance-002'],
  },

  {
    id: 'finance-004',
    category: 'finance',
    title: 'KCC — 4% వడ్డీకి రుణం',
    titleEn: 'Kisan Credit Card — Loan at 4%',
    icon: '💳',
    duration: '4 నిమిషాలు',
    difficulty: 'beginner',
    content: `## కిసాన్ క్రెడిట్ కార్డ్ (KCC)

KCC రైతులకు అత్యంత అనుకూలమైన రుణ పథకం.

**ప్రయోజనాలు:**
- వడ్డీ: కేవలం 4% (సమయానికి చెల్లిస్తే 2%తో కూడా!)
- ఒక ఎకరాకు ₹16,000 వరకు
- 5 సంవత్సరాలు valid
- ATM card ద్వారా నేరుగా డబ్బు తీయవచ్చు

**Apply ఎలా:**
1. SBI, ఆంధ్రా బ్యాంక్, NABARD linked bank కి వెళ్ళండి
2. Documents: Patta, Adangal, Aadhaar, Photo, Bank passbook

**Processing time:** 2-4 వారాలు

**4 ఎకరాల రైతుకు:**
- KCC limit: ₹64,000 వరకు
- మొత్తం వడ్డీ (సీజన్): ₹2,560 మాత్రమే
- Private lender దగ్గర ఇదే అప్పుకు: ₹15,000-20,000+

**ముఖ్యం:** KCC కార్డు తీసుకున్న తర్వాత సమయానికి చెల్లించండి — 3% interest subvention వస్తుంది, వడ్డీ రేటు 4% నుండి 1%కి తగ్గుతుంది!`,
    quiz: {
      question: 'KCC loan వడ్డీ రేటు ఎంత?',
      options: ['1%', '4%', '12%', '24%'],
      correctIndex: 1,
      explanation: 'KCC వడ్డీ 4%. సమయానికి చెల్లిస్తే government interest subvention వల్ల 1% వరకు తగ్గుతుంది!',
    },
    tags: ['kcc', 'loan', 'bank', 'credit', 'finance'],
    relatedLessons: ['finance-003', 'schemes-001'],
  },

  {
    id: 'finance-005',
    category: 'finance',
    title: 'పంట బీమా — PMFBY ద్వారా రక్షణ',
    titleEn: 'Crop Insurance via PMFBY',
    icon: '🛡️',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## PMFBY పంట బీమా

PMFBY (ప్రధానమంత్రి ఫసల్ బీమా యోజన) — రైతులకు చాలా తక్కువ ధరకు పంట రక్షణ.

**మీకు చెల్లించవలసిన premium:**
- ఖరీఫ్ పంటలు: Coverage మొత్తంలో **కేవలం 2%**
- రబీ పంటలు: **1.5%**

**ఉదాహరణ:**
- Coverage: ₹50,000/ఎకరా
- మీ premium: ₹1,000 మాత్రమే
- ప్రభుత్వం మిగతా 50-60% కడుతుంది

**ఏ నష్టాలకు coverage:**
- వర్షాభావం/కరువు
- వరద
- తెగుళ్లు, వ్యాధులు
- కోత సమయంలో వర్షాలు

**Apply ఎలా:**
1. pmfby.gov.in వెబ్‌సైట్
2. సమీప బ్యాంక్ లేదా CSC center
3. KCC loan తీసుకున్న రైతులకు automatically apply అవుతుంది

**Deadline:** విత్తు తేదీ నుండి 2 వారాలలోపు apply చేయండి!`,
    tags: ['insurance', 'pmfby', 'finance', 'protection'],
    relatedLessons: ['schemes-001', 'finance-003'],
  },

  // ──────────────────────────────────────────────────────────────────
  // Category 3: Government Schemes (ప్రభుత్వ పథకాలు)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'schemes-001',
    category: 'schemes',
    title: 'PM-KISAN — ₹6,000 ఎలా పొందాలి?',
    titleEn: 'How to Get PM-KISAN',
    icon: '🏛️',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## PM-KISAN — ₹6,000/సంవత్సరం

PM-KISAN అంటే ప్రధానమంత్రి కిసాన్ సమ్మాన్ నిధి. స్వంత జమీన్ ఉన్న రైతులందరికీ వర్తిస్తుంది.

**ఎంత వస్తుంది:**
- ₹2,000 × 3 విడతలు = **₹6,000/సంవత్సరం**
- నేరుగా బ్యాంక్ అకౌంట్‌లో జమ అవుతుంది

**అర్హత:**
- స్వంత పేరు మీద జమీన్ ఉండాలి
- Income Tax payer కాకూడదు
- Government employee కాకూడదు

**స్థితి చెక్ చేయడానికి:**
1. pmkisan.gov.in → Beneficiary Status
2. మీ Aadhaar నంబర్ ఎంటర్ చేయండి
3. తదుపరి వాయిదా తేది కనపడుతుంది

**రిజిస్ట్రేషన్ ఎలా:**
- Village Secretariat
- Meeseva center
- CSC center

**అకౌంట్‌లో డబ్బు రాలేదా?** Aadhaar-bank link చెక్ చేయండి. ఒక్కోసారి గుమాస్తా తప్పు వేసినా వస్తుంది.`,
    quiz: {
      question: 'PM-KISAN లో ఒక సంవత్సరానికి ఎంత వస్తుంది?',
      options: ['₹2,000', '₹4,000', '₹6,000', '₹10,000'],
      correctIndex: 2,
      explanation: 'PM-KISAN లో ₹2,000 చొప్పున 3 విడతలు, మొత్తం ₹6,000/సంవత్సరం వస్తుంది.',
    },
    tags: ['pm-kisan', 'government', 'schemes', 'subsidy', 'beginner'],
    relatedLessons: ['schemes-002', 'schemes-003'],
  },

  {
    id: 'schemes-002',
    category: 'schemes',
    title: 'YSR రైతు భరోసా — ₹13,500 అందుకోండి',
    titleEn: 'YSR Rythu Bharosa Scheme',
    icon: '🌾',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## YSR రైతు భరోసా

YSR రైతు భరోసా AP ప్రభుత్వ పథకం. PM-KISAN తో కలిపితే మొత్తం ₹19,500/సంవత్సరం!

**ఎంత వస్తుంది:**
- సాధారణ రైతులు: ₹13,500/సంవత్సరం
- SC/ST రైతులు: ₹15,000/సంవత్సరం
- విడతలు: రబీ + ఖరీఫ్ సీజన్ ముందు

**అర్హత:**
- AP లో భూమి ఉన్న రైతులు (tenant farmers కూడా అర్హులే!)
- కుటుంబానికి ఒక్కరికే వర్తిస్తుంది

**స్థితి చెక్:**
- rythu.ap.gov.in → Rythu Bharosa Status
- మీ Aadhaar లేదా Patta number ఎంటర్ చేయండి

**రాకపోతే:**
1. Village Secretariat లో సమస్య చెప్పండి
2. e-Seva center లో apply చేయండి
3. Aadhaar-Bank seeding verify చేయండి

AP రైతులు PM-KISAN + YSR రైతు భరోసా కలిపి ₹19,500 పొందవచ్చు. ఇద్దటికీ apply చేశారో లేదో చెక్ చేయండి!`,
    tags: ['ysr-bharosa', 'ap', 'government', 'schemes', 'subsidy'],
    relatedLessons: ['schemes-001', 'schemes-004'],
  },

  {
    id: 'schemes-003',
    category: 'schemes',
    title: 'e-NAM — ఆన్‌లైన్ లో మండీ ధరలు',
    titleEn: 'e-NAM Online Mandi Platform',
    icon: '📱',
    duration: '4 నిమిషాలు',
    difficulty: 'intermediate',
    content: `## e-NAM — జాతీయ వ్యవసాయ మార్కెట్

e-NAM (National Agriculture Market) ద్వారా మీ పంటను ఆన్‌లైన్‌లో అమ్మవచ్చు. దళారులు వద్దు — నేరుగా buyers దగ్గర నుండి ధర వస్తుంది.

**ఎందుకు మంచిది:**
- దేశ వ్యాప్తంగా ఉన్న buyers bidding చేస్తారు
- పారదర్శకమైన auction ప్రక్రియ
- APMC ని bypass చేయకుండా legal గా మంచి ధర పొందవచ్చు

**రిజిస్ట్రేషన్:**
1. enam.gov.in
2. Documents: Aadhaar, Bank account, Mobile number
3. రిజిస్ట్రేషన్ ఉచితం!

**ఎలా పని చేస్తుంది:**
- మీ పంట quality/grade ఎంటర్ చేయండి
- Registered buyers ఆన్‌లైన్‌లో bid చేస్తారు
- మీకు అనుకూలమైన bid accept చేయండి
- Payment directly to bank account

**ప్రస్తుతం AP లో e-NAM mandis:** 80+ mandis. అనంతపురం, కర్నూలు లో available.

**గమనిక:** Grade certification కోసం mandi లో quality check చేయించుకోవాలి.`,
    tags: ['enam', 'online', 'market', 'mandi', 'schemes'],
    relatedLessons: ['market-001', 'market-003'],
  },

  {
    id: 'schemes-004',
    category: 'schemes',
    title: 'NREGA — 100 రోజుల పని హామీ',
    titleEn: 'NREGA 100-Day Employment',
    icon: '🏗️',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## MGNREGA — 100 రోజుల పని హామీ

పంట పని లేని సమయంలో MGNREGA కింద పని పొందవచ్చు.

**ఎంత వస్తుంది:**
- AP లో: ₹257/రోజు (2024-25)
- 100 రోజులు పని హామీ
- కుటుంబానికి ₹25,700/సంవత్సరం వరకు

**ఎవరికి అర్హత:**
- Rural household లో adult members
- Job card కలిగి ఉండాలి
- Job card ఉచితం — Gram Panchayat లో తీసుకోండి

**పనులు:**
- Farm ponds తవ్వడం
- Bunds (గట్లు) నిర్మించడం
- Check dams
- Water conservation works

**రైతులకు ప్రత్యేక ప్రయోజనం:** మీ పొలంలో pond తవ్వించుకోవచ్చు — MGNREGA కూలి చెల్లిస్తారు. ₹0 ఖర్చుకే ₹50,000+ విలువైన నీటి సౌకర్యం!

Apply: Gram Panchayat లేదా Village Secretariat లో Job Card చేయించుకోండి.`,
    tags: ['nrega', 'employment', 'government', 'pond', 'water'],
    relatedLessons: ['farm-005', 'schemes-002'],
  },

  // ──────────────────────────────────────────────────────────────────
  // Category 4: Market Intelligence (మార్కెట్ తెలివి)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'market-001',
    category: 'market',
    title: 'MSP అంటే ఏమిటి? మీకు రావాల్సిన ధర',
    titleEn: 'What is MSP — Minimum Support Price',
    icon: '📊',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## MSP — కనీస మద్దతు ధర

MSP అంటే Minimum Support Price. ప్రభుత్వం నిర్ణయించిన కనీస ధర.

**2024-25 ముఖ్యమైన MSP ధరలు:**
| పంట | MSP |
|-----|-----|
| వేరుశెనగ | ₹6,783/quintal |
| పత్తి (medium) | ₹7,521/quintal |
| మొక్కజొన్న | ₹2,225/quintal |
| కందులు | ₹7,550/quintal |

**MSP కంటే తక్కువ ధరకు అమ్మకూడదు:**
- APMC మండిలో MSP కంటే తక్కువ ధర వేస్తే reject చేయండి
- Government Procurement Centers (PCO) దగ్గర MSP కి అమ్మవచ్చు

**ఎక్కడ అమ్మాలి:**
1. APMC మండి — auction లో best price
2. PCO (Procurement Center) — guaranteed MSP
3. e-NAM — nationwide buyers

**ముఖ్యం:** మండిలో grade (quality) చేయించుకోండి. Grade A కి Grade B కంటే ₹200-300 ఎక్కువ వస్తుంది.`,
    quiz: {
      question: '2024-25 లో వేరుశెనగ MSP ఎంత?',
      options: ['₹4,500', '₹5,500', '₹6,783', '₹8,000'],
      correctIndex: 2,
      explanation: '2024-25 లో వేరుశెనగ MSP ₹6,783/quintal. ఇంతకంటే తక్కువ ధరకు అమ్మకండి.',
    },
    tags: ['msp', 'market', 'price', 'groundnut', 'cotton', 'beginner'],
    relatedLessons: ['market-002', 'schemes-003'],
  },

  {
    id: 'market-002',
    category: 'market',
    title: 'మండిలో అమ్మేటప్పుడు 5 జాగ్రత్తలు',
    titleEn: '5 Tips for Selling at the Mandi',
    icon: '🏪',
    duration: '4 నిమిషాలు',
    difficulty: 'beginner',
    content: `## మండిలో అమ్మేటప్పుడు 5 జాగ్రత్తలు

మండికి వెళ్ళే ముందు ఈ 5 అంశాలు గుర్తుంచుకోండి.

### 1. తూకం తనిఖీ
- మండి తూకం machine calibrated అయి ఉందో లేదో చూడండి
- మీ దగ్గర కూడా తూకం ఉంటే verify చేయండి
- 1 quintal = 100 kg — ఇది తెలిసి ఉండాలి

### 2. Grade/Quality
- Grade A, B, C ఉంటాయి — Grade A కి ₹200-300 ఎక్కువ
- తేమ తక్కువగా ఉంటే (8-9%) మంచి grade వస్తుంది
- పంట clean గా, foreign material లేకుండా తీసుకెళ్ళండి

### 3. రసీదు తీసుకోండి
- పంట weight, grade, ధర అన్నీ రసీదులో రాయించుకోండి
- అర్కాటి commission రసీదులో mention అవ్వాలి (max 2%)

### 4. Payment
- Cash కంటే RTGS/NEFT ద్వారా నేరుగా bank account లో తీసుకోండి
- Payment receipt తప్పక తీసుకోండి

### 5. ధర పరిశోధన
- అమ్మే ముందు 3-4 రోజులు ధర చూడండి
- agmarknet.nic.in లో daily prices చూడవచ్చు
- రైతు మిత్ర market tab లో check చేయండి`,
    tags: ['mandi', 'market', 'selling', 'tips', 'beginner'],
    relatedLessons: ['market-001', 'market-003'],
  },

  {
    id: 'market-003',
    category: 'market',
    title: 'MRP చెక్ చేయండి — డీలర్ మోసం చేస్తున్నాడా?',
    titleEn: 'Check MRP — Is the Dealer Overcharging?',
    icon: '🏷️',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## MRP చెక్ చేయండి

విత్తనాలు, ఎరువులు, పురుగుమందులు కొనేటప్పుడు MRP (Maximum Retail Price) check చేయండి.

**MRP అంటే:**
- పాకెట్ / container మీద print అయిన గరిష్ట ధర
- ఇంత కంటే ఎక్కువ వసూలు చేయడం చట్టవిరుద్ధం

**సాధారణ MRP ఉదాహరణలు (2024-25):**
| పొరు | MRP |
|-----|-----|
| DAP ఒక బస్తా (50 kg) | ₹1,350 |
| యూరియా ఒక బస్తా (45 kg) | ₹266 |
| MOP ఒక బస్తా (50 kg) | ₹850 |

**డీలర్ MRP కంటే ఎక్కువ వసూలు చేస్తే:**
1. రసీదు తీసుకోండి — ఎంత ఖర్చయిందో రాయించండి
2. వ్యవసాయ కార్యాలయంలో complaint ఇవ్వండి
3. Toll free: 1800-180-1551 (Agricultural Ministry)

**కల్తీ ఎరువులు:**
- Certified dealer దగ్గరే కొనండి
- BIS mark, ISI mark చూడండి
- Batch number note చేయండి

రైతులు మోసపోకుండా — MRP చదవడం నేర్చుకోండి!`,
    tags: ['mrp', 'market', 'fertilizer', 'fraud', 'tips'],
    relatedLessons: ['market-002', 'finance-001'],
  },

  {
    id: 'market-004',
    category: 'market',
    title: 'ఏ సమయంలో అమ్మితే ఎక్కువ ధర?',
    titleEn: 'When to Sell for the Best Price',
    icon: '⏰',
    duration: '4 నిమిషాలు',
    difficulty: 'intermediate',
    content: `## ఏ సమయంలో అమ్మాలి?

పంట harvest అయిన వెంటనే అమ్మే రైతులు తక్కువ ధర పొందుతారు. కొంత ఆగితే ధర పెరుగుతుంది.

**వేరుశెనగ — ధర తీరు:**
- Harvest time (April-May): ధర తక్కువ — supply ఎక్కువ
- August-September: ధర 10-15% ఎక్కువ
- January-February: అత్యధిక ధర (off-season)

**ఎందుకు ఆగలేమని అనిపిస్తుంది:**
- అప్పులు చెల్లించాలి
- KCC loan clear చేయాలి
- పిల్లల చదువు, పండగ ఖర్చులు

**Storage solutions:**
- Warehouse Receipt System (WDRA): storage + receipt based loan
- Cold storage (కూరగాయలకు)
- Silo bags (grain storage)

**ఎంత ఆగాలి:**
| పంట | Ideal storage period | Expected gain |
|-----|---------------------|---------------|
| వేరుశెనగ | 3-6 నెలలు | 10-20% |
| పత్తి | 1-3 నెలలు | 5-10% |
| కందులు | 3-6 నెలలు | 15-25% |

**Warehouse Receipt Loan:** Storage certificate మీద 70-80% loan పొందవచ్చు. వడ్డీ తక్కువ, ధర పెరిగాక అమ్మవచ్చు.`,
    tags: ['selling', 'timing', 'market', 'storage', 'price'],
    relatedLessons: ['market-001', 'finance-004'],
  },

  // ──────────────────────────────────────────────────────────────────
  // Category 5: Health & Safety (ఆరోగ్యం)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'health-001',
    category: 'health',
    title: 'పురుగు మందు వాడేటప్పుడు జాగ్రత్తలు',
    titleEn: 'Pesticide Safety Guidelines',
    icon: '🧤',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## పురుగుమందు జాగ్రత్తలు — మీ ఆరోగ్యం ముఖ్యం!

ప్రతి సంవత్సరం వేలాది మంది రైతులు pesticide exposure వల్ల అనారోగ్యం పాలవుతున్నారు. ఈ జాగ్రత్తలు పాటించండి.

**తప్పనిసరి protective gear:**
- Gloves (latex/rubber)
- Mask (N95 లేదా simple cloth mask కూడా)
- Long sleeves, long pants
- Closed shoes (sandals వద్దు)
- Goggles (optional కానీ మంచిది)

**పిచికారీ చేసేటప్పుడు:**
- ఉదయం ఆరు నుండి పది మధ్య లేదా సాయంత్రం నాలుగు నుండి ఆరు మధ్య
- గాలికి ఎదురుగా నిలబడకండి
- పూర్తయిన తర్వాత తప్పనిసరిగా స్నానం చేయండి
- మిగిలిన మందు భూమిలో వేయండి — నీళ్ళలో వేయకండి

**Poisoning లక్షణాలు:**
- తలనొప్పి, వాంతులు, కళ్ళు మండటం
- వెంటనే hospital కి వెళ్ళండి
- తెచ్చుకున్న మందు packet తీసుకెళ్ళండి (doctor కి helpful)

**Emergency:**
- Poison Control: 1800-116-117 (Toll free)
- Nearest PHC / Government hospital

**పిల్లలు, గర్భిణులు** పొలానికి వద్దు — pesticide spray చేసిన 24-48 గంటల వరకు.`,
    tags: ['safety', 'pesticide', 'health', 'protective', 'beginner'],
    relatedLessons: ['farm-003', 'health-002'],
  },

  {
    id: 'health-002',
    category: 'health',
    title: 'ఎండాకాలంలో పనిచేసేటప్పుడు',
    titleEn: 'Working Safely in Summer Heat',
    icon: '☀️',
    duration: '3 నిమిషాలు',
    difficulty: 'beginner',
    content: `## ఎండాకాలంలో పొలం పని

అనంతపురం జిల్లాలో వేసవిలో 42-45°C వరకు ఉంటుంది. Heat stroke పొలంలో సాధారణంగా జరుగుతుంది.

**ఎప్పుడు పని చేయాలి:**
- ఉదయం 6-10 AM — సరైన సమయం
- సాయంత్రం 4-7 PM — సరైన సమయం
- ఉదయం 10 AM – సాయంత్రం 4 PM — వీలైతే మానుకోండి

**తప్పనిసరి:**
- 30 నిమిషాలకు ఒకసారి నీళ్ళు తాగండి (ఒక్కసారే ఎక్కువ వద్దు)
- తల కప్పుకోండి — తడి గుడ్డ కూడా help అవుతుంది
- ORS packet లేదా చిట్టిగుండు (lime+salt) water తాగండి

**Heat Stroke గుర్తింపు:**
- అకస్మాత్తుగా మూర్ఛ, తీవ్రమైన తలనొప్పి, confuse అవడం
- చెమట ఆగిపోవడం, చర్మం వేడిగా, ఎర్రగా అవడం

**మొదటి సహాయం:**
1. చల్లని నీడ వైపు తీసుకెళ్ళండి
2. శరీరానికి నీళ్ళు చల్లండి
3. వెంటనే 108 call చేయండి

**₹0 ఖర్చులో heat protection:**
- మర్రి ఆకులు / వేప పందిరి కింద విశ్రాంతి
- Buttermilk / ragi java తాగడం
- తడి తువ్వాలు తలపై వేసుకోవడం`,
    tags: ['heat', 'summer', 'health', 'safety', 'beginner', 'anantapur'],
    relatedLessons: ['health-001'],
  },
];

// ---------------------------------------------------------------------------
// Personalization
// ---------------------------------------------------------------------------

/**
 * Get lessons recommended for this farmer's context.
 * - Filter by crops (show groundnut lessons if they grow groundnut)
 * - Filter out completed lessons
 * - Sort by difficulty (beginner first)
 * - Limit to 5
 */
export function getRecommendedLessons(
  crops: string[],
  district: string,
  completedIds: string[],
): Lesson[] {
  const cropKeywords = crops.map(c => c.toLowerCase());
  const districtKeyword = district.toLowerCase();
  const completed = new Set(completedIds);

  // Score each lesson for relevance
  const scored: Array<{ lesson: Lesson; score: number }> = [];

  for (const lesson of CURRICULUM) {
    if (completed.has(lesson.id)) continue;

    let score = 0;

    // Crop match
    for (const tag of lesson.tags) {
      for (const crop of cropKeywords) {
        if (tag.includes(crop) || crop.includes(tag)) score += 3;
      }
    }

    // District match
    if (lesson.tags.some(t => t.includes(districtKeyword))) score += 2;

    // Beginner lessons get a small boost (easier to complete)
    if (lesson.difficulty === 'beginner') score += 1;

    // Always include scheme / finance lessons (universally useful)
    if (lesson.category === 'schemes' || lesson.category === 'finance') score += 1;

    scored.push({ lesson, score });
  }

  // Sort: first by score desc, then by difficulty (beginner < intermediate < advanced)
  const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return difficultyOrder[a.lesson.difficulty] - difficultyOrder[b.lesson.difficulty];
  });

  return scored.slice(0, 5).map(s => s.lesson);
}

/**
 * Get all lessons for a given category.
 */
export function getLessonsByCategory(category: Lesson['category']): Lesson[] {
  return CURRICULUM.filter(l => l.category === category);
}

/**
 * Get all lessons, grouped by category.
 */
export function getLessonsGrouped(): Record<Lesson['category'], Lesson[]> {
  return {
    farming: getLessonsByCategory('farming'),
    finance: getLessonsByCategory('finance'),
    schemes: getLessonsByCategory('schemes'),
    market: getLessonsByCategory('market'),
    health: getLessonsByCategory('health'),
  };
}
