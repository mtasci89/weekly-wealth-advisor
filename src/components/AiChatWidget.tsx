import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, X, Send, Trash2, ChevronDown, Loader2, AlertCircle, Settings,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ChatContext, sendChatMessage } from '@/services/aiChatService';
import { hasClaudeKey } from '@/services/apiKeyStore';
import { Asset } from '@/services/marketData';
import { AnalysisResult } from '@/services/analysisEngine';

// ── Hızlı soru şablonları ────────────────────────────────────
const QUICK_PROMPTS = [
  'Bu haftanın en güçlü BIST hisseleri hangileri?',
  'Portföyüme altın eklemeli miyim?',
  'Kripto bu hafta nasıl görünüyor?',
  'Düşük riskli yatırım için ne önerirsin?',
  'Dolar/TL baskısı hisse senetlerini nasıl etkiler?',
];

// ── Markdown renderer — inline component ─────────────────────
function MdMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
        li: ({ children }) => <li className="text-[13px]">{children}</li>,
        h3: ({ children }) => <h3 className="font-semibold text-sm mt-2 mb-0.5">{children}</h3>,
        h4: ({ children }) => <h4 className="font-semibold text-xs mt-1.5 mb-0.5">{children}</h4>,
        code: ({ children }) => (
          <code className="bg-secondary/70 text-primary font-mono text-xs px-1 py-0.5 rounded">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Props ─────────────────────────────────────────────────────
interface AiChatWidgetProps {
  assets: Asset[];
  analysis: AnalysisResult | null;
  onOpenSettings: () => void;
}

// ── Ana widget bileşeni ───────────────────────────────────────
export default function AiChatWidget({ assets, analysis, onOpenSettings }: AiChatWidgetProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [hasKey, setHasKey]       = useState(hasClaudeKey());

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const abortRef        = useRef<AbortController | null>(null);
  // Stale closure'u önlemek için messages/assets/analysis'i ref üzerinden oku
  const messagesRef     = useRef<ChatMessage[]>([]);
  const assetsRef       = useRef(assets);
  const analysisRef     = useRef(analysis);
  const isSendingRef    = useRef(false);

  // Ref'leri her render'da senkronize et
  messagesRef.current  = messages;
  assetsRef.current    = assets;
  analysisRef.current  = analysis;
  isSendingRef.current = isSending;

  // Key durumunu her açılışta yeniden kontrol et
  useEffect(() => {
    if (isOpen) setHasKey(hasClaudeKey());
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Mesaj gönder — dependency array'den messages/assets/analysis/isSending çıkarıldı,
  // bunlar ref üzerinden okunuyor → gereksiz yeniden oluşturma ve stale closure yok
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingRef.current) return;
    if (!hasClaudeKey()) { setError('Claude API anahtarı girilmemiş. Ayarlar\'dan ekleyin.'); return; }

    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    // Asistan placeholder
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantPlaceholder]);
    setIsSending(true);

    // Ref'lerden güncel değerleri al (stale closure yok)
    // Not: messagesRef.current henüz userMsg'yi içermiyor (setMessages async),
    // bu yüzden sadece önceki geçmişi gönderiyoruz — servis sonuna userMessage'ı kendisi ekliyor
    const ctx: ChatContext = { assets: assetsRef.current, analysis: analysisRef.current };
    const historySnapshot  = [...messagesRef.current]; // userMsg dahil değil — servis ekler
    abortRef.current = new AbortController();

    try {
      await sendChatMessage(
        historySnapshot,
        trimmed,
        ctx,
        (fullText) => {
          // Non-streaming: tüm metin tek seferde gelir, isStreaming'i de kapat
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId
                ? { ...m, content: fullText, isStreaming: false }
                : m
            )
          );
        },
        abortRef.current.signal
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let friendly: string;
      if (msg === 'CHAT_KEY_MISSING' || msg === 'CHAT_KEY_INVALID') {
        friendly = 'Claude API anahtarı geçersiz. Ayarlar\'dan kontrol edin.';
      } else if (msg === 'CHAT_RATE_LIMIT') {
        friendly = 'Claude API limiti aşıldı. Birkaç saniye bekleyin.';
      } else if (msg.includes('aborted') || msg.includes('abort') || (err instanceof Error && err.name === 'AbortError')) {
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        setIsSending(false);
        return;
      } else {
        // Gerçek hata kodunu göster — debug için
        friendly = `Hata: ${msg || 'Bilinmeyen hata'}`;
      }
      setError(friendly);
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }, []); // ← boş dependency: fonksiyon sadece mount'ta oluşturulur, ref'ler güncel kalır

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsSending(false);
  };

  const unreadCount = 0; // gelecekte bildirim için

  return (
    <>
      {/* ── Floating action button ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transition-all duration-200
          ${isOpen
            ? 'bg-destructive text-destructive-foreground rotate-90'
            : 'bg-primary text-primary-foreground hover:scale-110 hover:shadow-primary/30'}
        `}
        title={isOpen ? 'Kapat' : 'AI Finans Asistanı'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* ── Chat pop-up ── */}
      {isOpen && (
        <div
          className={`
            fixed bottom-24 right-6 z-50
            w-[380px] max-w-[calc(100vw-3rem)]
            h-[520px] max-h-[calc(100vh-8rem)]
            flex flex-col
            rounded-2xl border border-border bg-card shadow-2xl
            overflow-hidden
            animate-in slide-in-from-bottom-4 fade-in duration-200
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bot className="w-5 h-5 text-primary" />
                {isSending && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground font-mono">AI Finans Asistanı</p>
                <p className="text-[10px] text-muted-foreground">Claude Haiku · {assets.length} enstrüman yüklü</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Sohbeti temizle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Kapat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Claude key yoksa uyarı */}
          {!hasKey ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <div>
                <p className="font-semibold text-foreground text-sm">Claude API Anahtarı Gerekli</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI Finans Asistanı için Anthropic Console'dan Claude API anahtarı girin.
                  Portföy analizi için zaten Claude kullanıyorsanız aynı anahtar çalışır.
                </p>
              </div>
              <button
                onClick={() => { setIsOpen(false); onOpenSettings(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Ayarları Aç
              </button>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                console.anthropic.com → API keys
              </a>
            </div>
          ) : (
            <>
              {/* Mesaj listesi */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
                {/* Hoş geldin mesajı */}
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Bot className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                      <div className="bg-secondary/60 rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] text-foreground">
                        <p className="font-medium mb-1">Merhaba! Ben AI Finans Asistanınım 👋</p>
                        <p className="text-muted-foreground text-xs">
                          Platform verilerine erişimim var — hisse, fon veya piyasa hakkında her şeyi sorabilirsiniz.
                        </p>
                      </div>
                    </div>
                    {/* Hızlı soru önerileri */}
                    <div className="space-y-1.5 pl-8">
                      {QUICK_PROMPTS.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(q)}
                          className="block w-full text-left text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary text-muted-foreground transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mesajlar */}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <Bot className="w-5 h-5 text-primary shrink-0 mt-1" />
                    )}
                    <div
                      className={`
                        max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-secondary/60 text-foreground rounded-tl-sm'}
                      `}
                    >
                      {msg.role === 'assistant' ? (
                        <>
                          {msg.content
                            ? <MdMessage content={msg.content} />
                            : <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Düşünüyor...
                              </span>
                          }
                          {msg.isStreaming && msg.content && (
                            <span className="inline-block w-1 h-3.5 bg-primary animate-pulse ml-0.5 rounded-sm" />
                          )}
                        </>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Hata */}
                {error && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input alanı */}
              <div className="shrink-0 border-t border-border px-3 py-2.5 bg-card/50">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Soru sorun... (Enter: gönder, Shift+Enter: yeni satır)"
                    rows={1}
                    className="
                      flex-1 resize-none bg-secondary/50 border border-border rounded-xl
                      px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60
                      focus:outline-none focus:ring-2 focus:ring-ring
                      max-h-28 overflow-y-auto
                      font-sans leading-relaxed
                    "
                    style={{ minHeight: '38px' }}
                    onInput={e => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                    }}
                  />
                  {isSending ? (
                    <button
                      onClick={stopStreaming}
                      className="p-2.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
                      title="Durdur"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim()}
                      className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      title="Gönder (Enter)"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1 text-center">
                  Yatırım tavsiyesi değildir · Claude Haiku
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
