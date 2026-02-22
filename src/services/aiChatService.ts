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
// Payload boyutunu küçük tutmak için sadece özet veri gönderilir.

function buildSystemPrompt(ctx: ChatContext): string {
  const now = new Date().toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

  // Sadece top 3 / bot 3
  const sorted = [...ctx.assets].sort((a, b) => b.weeklyChangePct - a.weeklyChangePct);
  const top3 = sorted.slice(0, 3).map(a =>
    `${a.symbol}: %${a.weeklyChangePct > 0 ? '+' : ''}${a.weeklyChangePct.toFixed(2)} (${a.price.toFixed(2)})`
  ).join(', ');
  const bot3 = sorted.slice(-3).reverse().map(a =>
    `${a.symbol}: %${a.weeklyChangePct.toFixed(2)} (${a.price.toFixed(2)})`
  ).join(', ');

  // Kategori sayıları
  const cats = ctx.assets.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const catSummary = Object.entries(cats).map(([c, n]) => `${c}(${n})`).join(', ');

  // Aktif portföy önerisi — sadece sembol + ağırlık
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

// ── Claude Haiku streaming API ────────────────────────────────

const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const CLAUDE_URL   = 'https://api.anthropic.com/v1/messages';

/** Claude key mevcut mu? */
export { hasClaudeKey as hasChatKey };

/**
 * Claude Haiku'ya mesaj gönderir, SSE ile stream eder.
 * Her chunk geldiğinde onChunk callback'ini çağırır.
 */
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

  // Geçmişi Anthropic formatına çevir (streaming placeholder'ları dahil etme)
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
    stream: true,
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
    if (response.status === 401) throw new Error('CHAT_KEY_INVALID');
    if (response.status === 429) throw new Error('CHAT_RATE_LIMIT');
    throw new Error(`CHAT_HTTP_${response.status}: ${errText.slice(0, 200)}`);
  }

  if (!response.body) throw new Error('CHAT_NO_BODY');

  // SSE stream okuma — Anthropic event formatı
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') break;
      try {
        const parsed = JSON.parse(jsonStr);
        // Anthropic SSE: event type = "content_block_delta", delta.type = "text_delta"
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          const delta: string = parsed.delta.text ?? '';
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        }
      } catch {
        // JSON parse hatası — devam et
      }
    }
  }

  return fullText;
}

// ── Geriye dönük uyumluluk alias'ı (eski isim kullanılıyorsa) ──
export const sendGeminiMessage = sendChatMessage;
