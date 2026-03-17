/**
 * Rythu Mitra — Multi-Provider Web Search
 *
 * Solves the "drip irrigation follow-up failed" problem from yesterday's sprint.
 * The old performWebSearch() dies silently when Google keys are missing.
 * This module provides a 4-provider fallback chain:
 *
 *   1. Cached Agricultural Knowledge Base  (instant, offline, Telugu)
 *   2. DuckDuckGo Instant Answer API        (free, no key needed)
 *   3. Google Custom Search                 (if keys configured)
 *   4. Sarvam AI as knowledge retrieval     (always available when API key set)
 *
 * Integration point for actions.ts:
 *   import { performSearch } from './search';
 *   const results = await performSearch(query, loadSearchConfig());
 *
 * The existing performWebSearch() in actions.ts can call performSearch()
 * instead of rolling its own Google-only logic.
 */

import { loadConfig } from './sarvam';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchProvider = 'google' | 'duckduckgo' | 'sarvam' | 'cached';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: SearchProvider;
}

export interface SearchConfig {
  googleApiKey?: string;
  googleEngineId?: string;
  enableDuckDuckGo: boolean;
  enableSarvamSearch: boolean;
}

// DuckDuckGo Instant Answer API response shape (relevant parts only)
interface DDGResponse {
  Abstract?: string;
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Answer?: string;
  AnswerType?: string;
  RelatedTopics?: Array<DDGTopic | DDGTopicGroup>;
  Heading?: string;
}

interface DDGTopic {
  FirstURL?: string;
  Text?: string;
  // DDG groups have a Topics array instead
}

interface DDGTopicGroup {
  Topics?: DDGTopic[];
  Name?: string;
}

// ---------------------------------------------------------------------------
// Agricultural Knowledge Base (Telugu — 25+ entries for AP/Telangana farmers)
// ---------------------------------------------------------------------------

/**
 * Embedded knowledge base keyed by Telugu/English keywords.
 * Covers Anantapur crops (groundnut, cotton), government schemes,
 * pest/disease management, drip irrigation, and market terminology.
 *
 * Normalised lookup: query lowercased, each key checked as substring.
 */
const AGRICULTURAL_KB: Array<{ keywords: string[]; title: string; content: string; url: string }> = [
  // --- Pests & Diseases (వేరుశెనగ / Groundnut) ---
  {
    keywords: ['తెల్లదోమ', 'whitefly', 'తెల్ల దోమ'],
    title: 'తెల్లదోమ నివారణ — వేరుశెనగ',
    content:
      'తెల్లదోమ నివారణ: నీమ్ ఆయిల్ 5 ml/లీ నీటికి కలిపి పిచికారీ చేయండి. పసుపు రంగు అట్టపెట్టె ట్రాప్స్ పెట్టండి (ఎకరాకు 8-10). ఇమిడాక్లోప్రిడ్ 0.5 ml/లీ (డీలర్‌ను అడగండి). ఉదయం లేదా సాయంత్రం పిచికారీ చేయడం మంచిది.',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['ఆకు మచ్చ', 'leaf spot', 'tikka'],
    title: 'వేరుశెనగ ఆకు మచ్చ తెగులు',
    content:
      'వేరుశెనగ ఆకు మచ్చ (టిక్కా): మాంకొజెబ్ 2.5 g/లీ లేదా క్లోరోథలోనిల్ 2 g/లీ నీటికి కలిపి 15 రోజులకు ఒకసారి పిచికారీ. సీజన్‌లో 2-3 సార్లు. తేమ తక్కువగా ఉన్నపుడు వ్యాప్తి ఎక్కువ.',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['తుప్పు', 'rust', 'గిరుజు'],
    title: 'వేరుశెనగ తుప్పు తెగులు',
    content:
      'వేరుశెనగ తుప్పు తెగులు: ట్రైసైక్లాజోల్ 1 g/లీ లేదా హెక్సాకొనాజోల్ 1 ml/లీ నీటికి కలిపి పిచికారీ. ముందు జాగ్రత్తగా విత్తు సమయంలో ఒకసారి, 30 రోజులకు మళ్ళీ చేయండి.',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['కాండం కుళ్ళు', 'stem rot', 'collar rot'],
    title: 'వేరుశెనగ కాండం కుళ్ళు',
    content:
      'వేరుశెనగ కాండం/కాలర్ రాట్: విత్తు ముందు కార్బెండాజిమ్ 2 g/కిలో విత్తనాలకు ట్రీట్‌మెంట్ ఇవ్వండి. నేల నీరు నిలవకుండా చూడండి. తగ్గిన మొక్కలు తొలగించి బర్న్ చేయండి.',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['థ్రిప్స్', 'thrips', 'వేరుశెనగ పురుగు'],
    title: 'వేరుశెనగ థ్రిప్స్ నివారణ',
    content:
      'వేరుశెనగ థ్రిప్స్: స్పినోసాడ్ 0.5 ml/లీ లేదా ఇమిడాక్లోప్రిడ్ 0.3 ml/లీ పిచికారీ. నీళ్ళు తక్కువగా ఉంటే థ్రిప్స్ వ్యాప్తి ఎక్కువ — తేమ నిర్వహణ చాలా ముఖ్యం.',
    url: 'https://apagrisnet.gov.in',
  },

  // --- Pests & Diseases (పత్తి / Cotton) ---
  {
    keywords: ['పత్తి గులాబీ పురుగు', 'bollworm', 'pink bollworm', 'పురుగు'],
    title: 'పత్తి బాల్ వార్మ్ నివారణ',
    content:
      'పత్తి గులాబీ పురుగు నివారణ: BT పత్తి వేసుంటే నష్టం తక్కువ. ఫెరోమోన్ ట్రాప్స్ పెట్టండి (ఎకరాకు 5). సైపర్‌మెత్రిన్ 0.5 ml/లీ లేదా ఇండాక్సాకార్బ్ 0.75 ml/లీ (డీలర్‌ను అడగండి). 10-12 రోజులకు ఒకసారి.',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['పత్తి తెల్లదోమ', 'cotton whitefly', 'పత్తి రసంపీల్చు'],
    title: 'పత్తి తెల్లదోమ నివారణ',
    content:
      'పత్తి తెల్లదోమ: నీమ్ ఆయిల్ 5 ml/లీ + 1 ml డిటర్జెంట్ పిచికారీ. తీవ్రంగా ఉంటే ఫ్లోనికామిడ్ లేదా స్పిరోమెసిఫెన్ (డీలర్‌ను అడగండి). ఒకే medicine పదే పదే వాడకండి — రెసిస్టెన్స్ వస్తుంది.',
    url: 'https://apagrisnet.gov.in',
  },

  // --- Drip Irrigation (డ్రిప్ ఇరిగేషన్) ---
  {
    keywords: ['డ్రిప్ ఇరిగేషన్', 'drip irrigation', 'drip', 'నీటిపారుదల సబ్సిడీ'],
    title: 'డ్రిప్ ఇరిగేషన్ ఖర్చు & సబ్సిడీ',
    content:
      'డ్రిప్ నీటిపారుదల: ఎకరాకు ₹25,000–35,000 ఖర్చు. ప్రభుత్వ సబ్సిడీ 90% వరకు (SC/ST రైతులకు). పోలవరం ప్రాజెక్ట్ కింద అదనపు సహాయం అందుబాటులో ఉంది. దరఖాస్తు: apagrisnet.gov.in లేదా సమీప వ్యవసాయ కార్యాలయం. 40% నీరు ఆదా చేస్తుంది. PMKSY పథకం కింద కూడా apply చేయవచ్చు.',
    url: 'https://pmksy.gov.in',
  },
  {
    keywords: ['sprinkler', 'స్ప్రింక్లర్', 'మైక్రో ఇరిగేషన్'],
    title: 'స్ప్రింక్లర్ ఇరిగేషన్ సమాచారం',
    content:
      'స్ప్రింక్లర్ ఇరిగేషన్: ఎకరాకు ₹18,000–25,000. సబ్సిడీ: SC/ST రైతులకు 90%, ఇతరులకు 50%. పొడి పొలాలకు (వేరుశెనగ, జొన్న) చాలా మంచిది. నీళ్ళు 30-35% ఆదా. AP MIDH కింద apply చేయండి.',
    url: 'https://midh.gov.in',
  },

  // --- Government Schemes (ప్రభుత్వ పథకాలు) ---
  {
    keywords: ['pm-kisan', 'pmkisan', 'పిఎం కిసాన్', 'PM కిసాన్'],
    title: 'PM-KISAN పథకం',
    content:
      'PM-KISAN: ₹6,000/సంవత్సరం, 3 విడతలుగా ₹2,000 చొప్పున. స్వంత జమీన్ ఉన్న రైతులందరికీ వర్తిస్తుంది. చెక్ చేయడానికి: pmkisan.gov.in → Beneficiary Status → Aadhaar నంబర్. తదుపరి వాయిదా తేది: పోర్టల్‌లో చూడండి.',
    url: 'https://pmkisan.gov.in',
  },
  {
    keywords: ['ysr రైతు భరోసా', 'rythu bharosa', 'రైతు భరోసా', 'ap రైతు'],
    title: 'YSR రైతు భరోసా',
    content:
      'YSR రైతు భరోసా: ₹13,500/సంవత్సరం (SC/ST రైతులకు ₹15,000). PM-KISAN తో కలిపి మొత్తం ₹19,500 వరకు. రబీ + ఖరీఫ్ రెండు సీజన్లలో విడతలు. rythu.ap.gov.in లో స్థితి చెక్ చేయండి.',
    url: 'https://rythu.ap.gov.in',
  },
  {
    keywords: ['pmfby', 'crop insurance', 'పంట బీమా', 'పంటల బీమా', 'ఫసల్ బీమా'],
    title: 'PMFBY పంట బీమా',
    content:
      'PMFBY పంట బీమా: రైతు premium చాలా తక్కువ — ఖరీఫ్‌కు 2%, రబీకి 1.5%. ఉదా: ₹50,000 coverage కు ₹1,000 premium. ప్రకృతి విపత్తు, తెగులు, కరువు వల్ల నష్టానికి coverage. దరఖాస్తు: pmfby.gov.in లేదా బ్యాంక్.',
    url: 'https://pmfby.gov.in',
  },
  {
    keywords: ['kisan credit card', 'కిసాన్ క్రెడిట్ కార్డ్', 'kcc', 'రుణం', 'loan'],
    title: 'కిసాన్ క్రెడిట్ కార్డ్',
    content:
      'కిసాన్ క్రెడిట్ కార్డ్: వ్యవసాయ అవసరాలకు తక్కువ వడ్డీకి రుణం (3-4%). ఒక ఎకరాకు సుమారు ₹16,000 వరకు. దరఖాస్తు: SBI, ఆంధ్రా బ్యాంక్, NABARD linked banks. Documents: Patta, Adangal, Aadhaar, Photo.',
    url: 'https://www.nabard.org',
  },
  {
    keywords: ['రైతు భీమా', 'farmer life insurance', 'ఎన్ఎఫ్ఎస్', 'nfs'],
    title: 'AP రైతు భీమా',
    content:
      'AP రైతు భీమా: AP ప్రభుత్వం రైతు మరణిస్తే కుటుంబానికి ₹5,00,000 జీవిత బీమా అందిస్తోంది. ఈ పథకానికి రైతు ఎలాంటి premium కట్టక్కర్లేదు. దరఖాస్తు: meeseva లేదా village secretariat.',
    url: 'https://ap.gov.in',
  },

  // --- Fertilizers (ఎరువులు) ---
  {
    keywords: ['యూరియా', 'urea', 'నత్రజని ఎరువు'],
    title: 'యూరియా వినియోగం',
    content:
      'యూరియా (46% N): వేరుశెనగకు ఎకరాకు 20-25 కిలోలు సిఫారసు. విత్తిన 15-20 రోజులకు తడి మట్టిలో వేయండి. ఎక్కువగా వేయకండి — ఆకులు పెద్దవి అవుతాయి, కాయలు తక్కువ వస్తాయి. పత్తికి ఎకరాకు 50-60 కిలోలు.',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['డిఎపి', 'dap', 'ఫాస్ఫేట్'],
    title: 'DAP ఎరువు వినియోగం',
    content:
      'DAP (18-46-0): విత్తు సమయంలో ఎకరాకు 50 కిలోలు (వేరుశెనగ) లేదా 75 కిలోలు (పత్తి). నేలలో కలిపి విత్తండి. గైప్సమ్‌తో కలిపి వేస్తే వేరుశెనగకు అదనపు ప్రయోజనం. 2023 MRP: ₹1,350/బస్తా (50 kg).',
    url: 'https://apagrisnet.gov.in',
  },
  {
    keywords: ['గైప్సం', 'gypsum', 'కాల్షియం సల్ఫేట్'],
    title: 'వేరుశెనగకు గైప్సమ్',
    content:
      'వేరుశెనగకు గైప్సమ్ (calcium sulfate) తప్పనిసరి: పొడి బెట్టుకునే సమయంలో (flowering దశలో) ఎకరాకు 200-250 కిలోలు వేయండి. కాయ నింపడం మెరుగ్గా జరుగుతుంది. ధర: ₹6-7/కిలో. government subsidy లో అందుబాటులో ఉంటుంది.',
    url: 'https://apagrisnet.gov.in',
  },

  // --- Market Terminology (మార్కెట్ పరిభాష) ---
  {
    keywords: ['msp', 'minimum support price', 'మద్దతు ధర', 'కనీస మద్దతు'],
    title: 'MSP — కనీస మద్దతు ధర',
    content:
      'MSP (Minimum Support Price): ప్రభుత్వం నిర్ణయించిన కనీస ధర. 2024-25లో వేరుశెనగ MSP: ₹6,783/quintal. పత్తి MSP: ₹7,521/quintal (medium staple). మీ పంట MSP కంటే తక్కువ ధరకు అమ్మకూడదు — ప్రభుత్వ procurement centres ఉన్నాయి.',
    url: 'https://cacp.dacnet.nic.in',
  },
  {
    keywords: ['క్వింటాల్', 'quintal', 'మానికెం', 'బస్తా weight'],
    title: 'వ్యవసాయ తూకాలు',
    content:
      '1 Quintal = 100 kg. 1 Bag (బస్తా) = 50-100 kg (పంట బట్టి మారుతుంది). వేరుశెనగ: 1 బస్తా = 50 kg. పత్తి: 1 క్యాండీ = 355 kg. మండిలో తూకం వేసేటప్పుడు తేమ తగ్గితే ధర పెరుగుతుంది.',
    url: '',
  },
  {
    keywords: ['మండి', 'mandi', 'మార్కెట్ యార్డ్', 'agmarket'],
    title: 'ఆంధ్రప్రదేశ్ మండీ ధరలు',
    content:
      'AP మండీ ధరలు: agmarknet.nic.in వెబ్‌సైట్‌లో రోజువారీ ధరలు చూడవచ్చు. అనంతపురంలో: అనంతపురం APMC, కల్యాణ్‌దుర్గ్, ధర్మవరం మార్కెట్ యార్డ్స్. e-NAM platform లో online trading కూడా.',
    url: 'https://agmarknet.nic.in',
  },
  {
    keywords: ['అరెకా', 'areca', 'arkattu', 'సేల్ రసీదు', 'అర్కాటి'],
    title: 'మండీ అర్కాటి కమీషన్',
    content:
      'మండీ అర్కాటి: commission agent కి 2% వరకు కమీషన్ చెల్లిస్తారు. APMC నిబంధనల ప్రకారం ₹100 కంటే ఎక్కువ కమీషన్ వసూలు చేయకూడదు. మీ పంట weight, grade, ధర అన్నీ రసీదులో రాసి ఇవ్వాలి.',
    url: '',
  },

  // --- Seasonal / Weather (సీజన్ / వాతావరణం) ---
  {
    keywords: ['ఖరీఫ్', 'kharif', 'వర్షాకాలం పంట'],
    title: 'ఖరీఫ్ సీజన్ గైడ్',
    content:
      'ఖరీఫ్ సీజన్ (AP/TG): జూన్–నవంబర్. ప్రధాన పంటలు: వేరుశెనగ, పత్తి, వరి, మొక్కజొన్న, కందులు. అనంతపురంలో సగటు వర్షపాతం 550mm. మునుపు ఖరీఫ్ విత్తు: జూన్ 15 - జూలై 15.',
    url: '',
  },
  {
    keywords: ['రబి', 'rabi', 'రబీ', 'శీతాకాలం పంట'],
    title: 'రబీ సీజన్ గైడ్',
    content:
      'రబీ సీజన్ (AP/TG): అక్టోబర్–మార్చి. ప్రధాన పంటలు: సజ్జలు, జొన్న, బొబ్బర్లు, శనగలు, గోధుమ (irrigated areas). బోరు బావి water level ఈ సీజన్‌లో తగ్గుతుంది — drip/sprinkler తప్పనిసరి.',
    url: '',
  },

  // --- Seeds (విత్తనాలు) ---
  {
    keywords: ['వేరుశెనగ విత్తనాలు', 'groundnut seed', 'tml', 'kadiri'],
    title: 'వేరుశెనగ మేలైన రకాలు',
    content:
      'వేరుశెనగ మేలైన రకాలు (అనంతపురం): TG-26 (Kadiri-6), K-134, Girnar-4. AP seeds corporation లో certified seeds దొరుకుతాయి. ఎకరాకు 80-100 కిలోలు విత్తనం అవసరం. విత్తు ముందు Rhizobium treatment చేస్తే nitrogen fixation మెరుగవుతుంది.',
    url: 'https://apseeds.ap.gov.in',
  },
  {
    keywords: ['పత్తి విత్తనాలు', 'bt cotton seed', 'cotton variety'],
    title: 'పత్తి BT విత్తనాలు',
    content:
      'BT పత్తి విత్తనాలు: MAHYCO, Nuziveedu Seeds, Rasi Seeds బ్రాండ్లు మార్కెట్‌లో ఉన్నాయి. ఎకరాకు 1 packet (450g) సరిపోతుంది. మే 15 – జూన్ 15 విత్తు time. APSDP approved varieties మాత్రమే కొనండి.',
    url: 'https://apseeds.ap.gov.in',
  },
];

// ---------------------------------------------------------------------------
// Knowledge Base Search (pure function — no async, no network)
// ---------------------------------------------------------------------------

/**
 * Search the embedded agricultural knowledge base.
 * Returns up to 2 matches sorted by keyword match count.
 *
 * Pure function — safe to call in tests without any mocks.
 */
export function searchKnowledgeBase(query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored: Array<{ entry: typeof AGRICULTURAL_KB[0]; score: number }> = [];

  for (const entry of AGRICULTURAL_KB) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (q.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(q)) {
        score += 2;
      }
      // Partial word match (e.g. "తెల్ల" matches "తెల్లదోమ")
      const kw = keyword.toLowerCase();
      if (q.length >= 3 && kw.includes(q.slice(0, Math.floor(q.length * 0.7)))) {
        score += 1;
      }
    }
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  // Sort by score descending, return top 2
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(({ entry }) => ({
    title: entry.title,
    snippet: entry.content,
    url: entry.url,
    source: 'cached' as SearchProvider,
  }));
}

// ---------------------------------------------------------------------------
// DuckDuckGo Instant Answer API
// ---------------------------------------------------------------------------

/**
 * Build the DuckDuckGo API URL for a query.
 * Appends Telugu/agricultural context to improve results.
 * Pure function — safe to test without network.
 */
export function buildDDGUrl(query: string): string {
  // Append agricultural context for better relevance
  const enriched = query.includes('agriculture')
    || query.includes('farm')
    || query.includes('crop')
    || query.includes('farmer')
    ? query
    : `${query} agriculture farming Telugu Andhra Pradesh`;

  return `https://api.duckduckgo.com/?q=${encodeURIComponent(enriched)}&format=json&no_html=1&skip_disambig=1`;
}

/**
 * Parse a DuckDuckGo API response into SearchResult[].
 * Handles both direct answers and related topics.
 * Pure function — safe to test without network.
 */
export function formatDDGResponse(data: DDGResponse, originalQuery: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Primary: direct abstract (Wikipedia-style answer)
  if (data.AbstractText && data.AbstractText.length > 30) {
    results.push({
      title: data.Heading || originalQuery,
      snippet: data.AbstractText.slice(0, 400),
      url: data.AbstractURL || 'https://duckduckgo.com',
      source: 'duckduckgo',
    });
  }

  // Secondary: instant answer (e.g. "1 Quintal = 100 kg")
  if (data.Answer && data.Answer.length > 5 && results.length === 0) {
    results.push({
      title: originalQuery,
      snippet: data.Answer,
      url: 'https://duckduckgo.com',
      source: 'duckduckgo',
    });
  }

  // Tertiary: related topics (flat topics only, not nested groups)
  if (results.length === 0 && data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      // Skip topic groups
      if ('Topics' in topic && topic.Topics) continue;
      const flat = topic as DDGTopic;
      if (flat.Text && flat.Text.length > 20) {
        results.push({
          title: flat.Text.slice(0, 60),
          snippet: flat.Text.slice(0, 300),
          url: flat.FirstURL || 'https://duckduckgo.com',
          source: 'duckduckgo',
        });
        if (results.length >= 2) break;
      }
    }
  }

  return results;
}

/**
 * Search via DuckDuckGo Instant Answer API.
 * Free, no API key needed, no rate limits for reasonable usage.
 */
export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = buildDDGUrl(query);
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as DDGResponse;
    return formatDDGResponse(data, query);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Google Custom Search
// ---------------------------------------------------------------------------

/**
 * Search via Google Custom Search API.
 * Requires API key + engine ID from localStorage.
 */
export async function searchGoogle(query: string, config: SearchConfig): Promise<SearchResult[]> {
  if (!config.googleApiKey || !config.googleEngineId) return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${config.googleApiKey}&cx=${config.googleEngineId}&q=${encodeURIComponent(query)}&num=3`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = (await response.json()) as {
      items?: Array<{ title: string; snippet: string; link: string }>;
    };

    return (data.items || []).slice(0, 3).map(item => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
      source: 'google' as SearchProvider,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sarvam AI as Knowledge Source (last-resort fallback)
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for Sarvam knowledge retrieval mode.
 * Different from main chat — focused, factual, concise.
 * Pure function — safe to test without network.
 */
export function buildSarvamSearchPrompt(): string {
  return `మీరు ఒక వ్యవసాయ నిపుణులు. మీరు ఆంధ్రప్రదేశ్/తెలంగాణ రైతులకు సహాయం చేస్తారు.
దిగువ ప్రశ్నకు తెలుగులో సంక్షిప్తంగా, నిజమైన సమాచారంతో జవాబు ఇవ్వండి.
మీకు తెలియకపోతే నేరుగా చెప్పండి — అంచనాలు వేయకండి.
జవాబు 3-4 వాక్యాలలో ఇవ్వండి. ముఖ్యమైన సంఖ్యలు, ధరలు చేర్చండి.`;
}

/**
 * Use Sarvam 105B as a knowledge source for the query.
 * This is a DIFFERENT call from the main chat — separate model instance, focused prompt.
 */
export async function searchViaSarvam(query: string): Promise<SearchResult[]> {
  const config = loadConfig();
  if (!config.apiKey) return [];

  try {
    const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': config.apiKey,
      },
      body: JSON.stringify({
        model: config.chatModel || 'sarvam-105b',
        messages: [
          { role: 'system', content: buildSarvamSearchPrompt() },
          { role: 'user', content: query },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content || content.length < 10) return [];

    return [{
      title: query,
      snippet: content.trim(),
      url: '',
      source: 'sarvam' as SearchProvider,
    }];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/**
 * Load search configuration from localStorage.
 * Reads Google keys if present, enables DuckDuckGo and Sarvam by default.
 */
export function loadSearchConfig(): SearchConfig {
  return {
    googleApiKey: localStorage.getItem('rythu_mitra_search_api_key') ?? undefined,
    googleEngineId: localStorage.getItem('rythu_mitra_search_engine_id') ?? undefined,
    enableDuckDuckGo: true,
    enableSarvamSearch: true,
  };
}

// ---------------------------------------------------------------------------
// Main fallback chain
// ---------------------------------------------------------------------------

/**
 * Search with 4-provider fallback chain.
 *
 * Order:
 *   1. Cached KB  — instant, offline-capable, Telugu content
 *   2. DuckDuckGo — free, no key, good for factual queries
 *   3. Google     — best quality, requires API key
 *   4. Sarvam     — always available when Sarvam key is set
 *
 * Returns first non-empty result set.
 * Never throws — all providers handle their own errors internally.
 */
export async function search(query: string, config: SearchConfig): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  // 1. Cached Agricultural Knowledge Base (instant, offline)
  const cached = searchKnowledgeBase(query);
  if (cached.length > 0) return cached;

  // 2. DuckDuckGo (free, no key)
  if (config.enableDuckDuckGo) {
    const ddg = await searchDuckDuckGo(query);
    if (ddg.length > 0) return ddg;
  }

  // 3. Google Custom Search (if keys configured)
  if (config.googleApiKey && config.googleEngineId) {
    const google = await searchGoogle(query, config);
    if (google.length > 0) return google;
  }

  // 4. Sarvam AI knowledge retrieval (final fallback)
  if (config.enableSarvamSearch) {
    return searchViaSarvam(query);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Top-level integration: drop-in replacement for performWebSearch() logic
// ---------------------------------------------------------------------------

/**
 * Perform a multi-provider search and return Telugu-friendly text summary.
 *
 * This is the integration point for actions.ts — call this from performWebSearch().
 * Returns both the result array (for SearchResults.svelte) and a text summary.
 */
export async function performSearch(query: string): Promise<{
  results: SearchResult[];
  summary: string;
}> {
  const config = loadSearchConfig();
  const results = await search(query, config);

  if (results.length === 0) {
    return {
      results: [],
      summary: `🔍 "${query}" కోసం సమాచారం దొరకలేదు. మీ వ్యవసాయ అధికారిని అడగండి.`,
    };
  }

  const sourceLabel: Record<SearchProvider, string> = {
    cached: '📚 నా జ్ఞానం',
    duckduckgo: '🔍 వెబ్',
    google: '🔍 Google',
    sarvam: '🧠 AI',
  };

  const lines: string[] = [];
  for (const r of results) {
    const label = sourceLabel[r.source];
    lines.push(`${label}: ${r.snippet}`);
    if (r.url) lines.push(`  ${r.url}`);
  }

  return {
    results,
    summary: lines.join('\n'),
  };
}
