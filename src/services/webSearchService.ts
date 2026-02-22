import { getApiKeys, hasTavilyKey } from './apiKeyStore';

export interface MacroContext {
  /** Tüm arama sonuçlarından derlenen tek metin blok (Claude prompt'a eklenir) */
  text: string;
  /** Kaç kaynak kullanıldı */
  sourceCount: number;
  /** Başarılı mı yoksa fallback metin mi */
  success: boolean;
}

interface TavilyResult {
  title: string;
  content: string;
  url: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResult[];
  answer?: string;
  error?: string;
}

/** Tavily API'ye tek bir sorgu gönderir, en iyi 3 sonucun özetini döner */
async function tavilySearch(query: string, apiKey: string): Promise<TavilyResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',      // hız için basic
      max_results: 3,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`TAVILY_ERROR_${response.status}`);
  }

  const data: TavilyResponse = await response.json();
  if (data.error) throw new Error(`TAVILY_API: ${data.error}`);
  return data.results ?? [];
}

/** Bugünkü tarihe göre sorgu parametresi ekler */
function withDate(query: string): string {
  const now = new Date();
  return `${query} ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
}

/**
 * 3 paralel Tavily sorgusu:
 * 1. Türkiye merkez bankası / enflasyon / faiz
 * 2. Global piyasalar / Fed / dolar endeksi
 * 3. Kripto / altın makro görünüm
 *
 * Tüm sonuçlar tek bir metin bloğuna sıkıştırılır ve döner.
 * Tavily anahtarı yoksa veya hata alınırsa boş MacroContext döner.
 */
export async function fetchMacroContext(): Promise<MacroContext> {
  if (!hasTavilyKey()) {
    return { text: '', sourceCount: 0, success: false };
  }

  const apiKey = getApiKeys().tavily;

  const queries = [
    withDate('Türkiye merkez bankası faiz kararı enflasyon son gelişmeler'),
    withDate('global markets Fed interest rate decision USD DXY outlook'),
    withDate('Bitcoin gold safe haven macro outlook weekly'),
  ];

  try {
    const results = await Promise.allSettled(
      queries.map(q => tavilySearch(q, apiKey))
    );

    const snippets: string[] = [];
    let sourceCount = 0;

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`Tavily sorgu ${i + 1} başarısız:`, r.reason);
        return;
      }
      r.value.forEach(item => {
        if (!item.content) return;
        // İlk 300 karakteri al (prompt token tasarrufu için)
        const excerpt = item.content.slice(0, 300).replace(/\s+/g, ' ').trim();
        snippets.push(`• [${item.title}] ${excerpt}`);
        sourceCount++;
      });
    });

    if (snippets.length === 0) {
      return { text: '', sourceCount: 0, success: false };
    }

    const text = `GÜNCEL MAKROEKONOMİK BAĞLAM (web araştırması):\n${snippets.join('\n')}`;
    return { text, sourceCount, success: true };
  } catch (err) {
    console.warn('Macro context fetch failed:', err);
    return { text: '', sourceCount: 0, success: false };
  }
}
