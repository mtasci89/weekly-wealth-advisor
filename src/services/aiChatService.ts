import { getApiKeys, hasClaudeKey } from './apiKeyStore';
import { Asset } from './marketData';
import { AnalysisResult } from './analysisEngine';

// ── Types ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatContext {
  assets: Asset[];
  analysis: AnalysisResult | null;
}

// ── System prompt builder ─────────────────────────────────────

function buildSystemPrompt(ctx: ChatContext): string {
  const now = new Date().toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

  const sorted = [...ctx.assets].sort((a, b) => b.weeklyChangePct - a.weeklyChangePct);
  const top3 = sorted.slice(0, 3).map(a =>
    `${a.symbol}: %${a.weeklyChangePct > 0 ? '+' : ''}${a.weeklyChangePct.toFixed(2)} (${a.price.toFixed(2)})`
  ).join(', ');
  const bot3 = sorted.slice(-3).reverse().map(a =>
    `${a.symbol}: %${a.weeklyChangePct.toFixed(2)} (${a.price.toFixed(2)})`
  ).join(', ');

  const cats = ctx.assets.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const catSummary = Object.entries(cats).map(([c, n]) => `${c}(${n})`).join(', ');

  const recSection = ctx.analysis?.recommendations?.length
    ? `\nAKTİF PORTFÖY: ${ctx.analysis.recommendations
        .map(r => `${r.symbol}%${r.allocation}`)
        .join(', ')}`
    : '';

  return `Sen PortföyAI'nin finans asistanısın. Türk yatırımcılara kısa ve net bilgi ver.
Tarih: ${now} | ${ctx.assets.length} enstrüman yüklü | Kategoriler: ${catSummary}
Haftalık güçlü: ${top3}
Haftalık zayıf: ${bot3}${recSection}

Kurallar: Türkçe yanıt ver. Kısa ve aksiyon odaklı ol. Kesin "al/sat" yerine "güçlü görünüyor/dikkatli ol" kullan. Markdown kullan.`;
}

// ── Claude Haiku API (non-streaming) ─────────────────────────
// Streaming SSE tarayıcıdan CORS sorunlarına yol açabilir;
// analysisEngine.ts ile aynı non-streaming yaklaşım kullanılıyor.

const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const CLAUDE_URL   = 'https://api.anthropic.com/v1/messages';

export { hasClaudeKey as hasChatKey };

export async function sendChatMessage(
  history: ChatMessage[],
  userMessage: string,
  ctx: ChatContext,
  onChunk: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = getApiKeys().claude;
  if (!apiKey) throw new Error('CHAT_KEY_MISSING');

  const systemPrompt = buildSystemPrompt(ctx);

  const messages = [
    ...history
      .filter(m => !m.isStreaming && m.content.trim())
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user' as const, content: userMessage },
  ];

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    // stream: false — analysisEngine.ts ile aynı pattern
  };

  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[Chat] API error', response.status, errText);
    if (response.status === 401) throw new Error('CHAT_KEY_INVALID');
    if (response.status === 429) throw new Error('CHAT_RATE_LIMIT');
    throw new Error(`CHAT_HTTP_${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '';

  if (!text) {
    console.error('[Chat] Empty response:', data);
    throw new Error('CHAT_EMPTY_RESPONSE');
  }

  // onChunk'u tek seferde tüm metinle çağır (non-streaming simülasyonu)
  onChunk(text);
  return text;
}

// Geriye dönük uyumluluk
export const sendGeminiMessage = sendChatMessage;
