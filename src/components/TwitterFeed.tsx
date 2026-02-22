import { useState, useEffect, useRef, useCallback } from 'react';
import { Twitter, Plus, X, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

// ── localStorage key ─────────────────────────────────────────
const STORAGE_KEY = 'portfolyoai_tweet_urls';

// ── Twitter Widget script loader ─────────────────────────────
// Script bir kez yüklenir, promise saklanır (her embed yeniden yüklemez)
let twitterScriptPromise: Promise<void> | null = null;

function loadTwitterScript(): Promise<void> {
  if (twitterScriptPromise) return twitterScriptPromise;
  twitterScriptPromise = new Promise((resolve, reject) => {
    // Zaten yüklüyse direkt çöz
    if ((window as unknown as Record<string, unknown>).twttr) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => resolve();
    script.onerror = () => {
      twitterScriptPromise = null; // sonraki denemede tekrar yükle
      reject(new Error('Twitter script failed to load'));
    };
    document.head.appendChild(script); // body yerine head — daha erken parse edilir
  });
  return twitterScriptPromise;
}

// ── Tweet URL → embed ID extraction ─────────────────────────
function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

function extractUsername(url: string): string {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\//);
  return match ? `@${match[1]}` : '@unknown';
}

// ── TweetEmbed tekil tweet bileşeni ─────────────────────────
interface TweetEmbedProps {
  tweetId: string;
  username: string;
  onRemove: () => void;
  isDark: boolean;
}

function TweetEmbed({ tweetId, username, onRemove, isDark }: TweetEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const renderTweet = async () => {
      setStatus('loading');

      try {
        await loadTwitterScript();
      } catch {
        if (!cancelled) setStatus('error');
        return;
      }

      if (cancelled || !containerRef.current) return;

      // Önceki içeriği temizle (theme değişimi veya re-render durumunda)
      containerRef.current.innerHTML = '';

      type TwttrAPI = {
        widgets?: {
          createTweet?: (
            id: string,
            el: HTMLElement,
            opts: Record<string, unknown>
          ) => Promise<HTMLElement | undefined>;
        };
      };

      const twttr = (window as unknown as Record<string, TwttrAPI>)['twttr'];

      if (!twttr?.widgets?.createTweet) {
        if (!cancelled) setStatus('error');
        return;
      }

      try {
        const el = await twttr.widgets.createTweet(tweetId, containerRef.current, {
          theme: isDark ? 'dark' : 'light',
          lang: 'tr',
          dnt: true,
          cards: 'hidden',
          conversation: 'none',
        });

        if (cancelled) return;

        if (el) {
          setStatus('loaded');
        } else {
          // Tweet silinmiş, gizlenmiş veya erişilemiyor
          setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    renderTweet();
    return () => { cancelled = true; };
  }, [tweetId, isDark]);

  return (
    <div className="relative group">
      {/* Kaldır butonu */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
        title="Tweeti kaldır"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Hata durumu */}
      {status === 'error' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">Tweet yüklenemedi</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {username} — Tweet silinmiş, gizlenmiş veya erişilemiyor olabilir.
          </p>
          <a
            href={`https://twitter.com/i/web/status/${tweetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Twitter'da aç
          </a>
        </div>
      )}

      {/*
        Twitter widget konteyneri:
        CRITICAL: Her zaman display:block olmalı — createTweet iframe'i renderlarken
        boyut hesaplar. display:none ise iframe 0px olur ve tweet gözükmez.

        Loading süresince: tam genişlikte, min-height verilmiş, arka plan animasyonlu.
        Twitter içeriği gelince doğal yüksekliğe geçer.
        Error'da: display:none (üstte hata kutusu gösteriliyor).
      */}
      <div
        ref={containerRef}
        style={{ display: status === 'error' ? 'none' : 'block' }}
        className={
          status === 'loading'
            ? 'rounded-xl border border-border bg-card/30 animate-pulse min-h-[140px]'
            : ''
        }
      />
    </div>
  );
}

// ── Ana TwitterFeed paneli ────────────────────────────────────
interface TwitterFeedProps {
  isDark: boolean;
}

interface SavedTweet {
  id: string;
  url: string;
  username: string;
  addedAt: number;
}

export default function TwitterFeed({ isDark }: TwitterFeedProps) {
  const [tweets, setTweets] = useState<SavedTweet[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [inputUrl, setInputUrl] = useState('');
  const [inputError, setInputError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const saveTweets = useCallback((updated: SavedTweet[]) => {
    setTweets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const handleAdd = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) { setInputError('URL boş olamaz.'); return; }

    const tweetId = extractTweetId(trimmed);
    if (!tweetId) {
      setInputError('Geçerli bir Twitter/X tweet linki yapıştırın.\nÖrnek: https://x.com/hesap/status/123456789');
      return;
    }

    if (tweets.some(t => t.id === tweetId)) {
      setInputError('Bu tweet zaten listede mevcut.');
      return;
    }

    const newTweet: SavedTweet = {
      id: tweetId,
      url: trimmed,
      username: extractUsername(trimmed),
      addedAt: Date.now(),
    };

    saveTweets([newTweet, ...tweets]);
    setInputUrl('');
    setInputError('');
  };

  const handleRemove = (id: string) => {
    saveTweets(tweets.filter(t => t.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Panel başlığı */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Twitter className="w-4 h-4 text-[#1DA1F2]" />
          <h2 className="font-mono font-semibold text-sm text-foreground">
            Analist Tweetleri
          </h2>
          {tweets.length > 0 && (
            <span className="text-xs bg-secondary text-secondary-foreground font-mono px-1.5 py-0.5 rounded">
              {tweets.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title={isCollapsed ? 'Genişlet' : 'Daralt'}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-5 space-y-4">
          {/* URL girdi */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={e => { setInputUrl(e.target.value); setInputError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="https://x.com/kullanici/status/123456..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-secondary/50 text-foreground text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <button
                onClick={handleAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                Ekle
              </button>
            </div>
            {inputError && (
              <p className="text-xs text-destructive whitespace-pre-line">{inputError}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Takip ettiğiniz analist veya yatırımcının tweet linkini yapıştırın — embed olarak görüntülenir.
            </p>
          </div>

          {/* Tweet listesi */}
          {tweets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <Twitter className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-sm">Henüz tweet eklenmedi.</p>
              <p className="text-xs">Yukarıya tweet linki yapıştırarak takip ettiğiniz analistlerin paylaşımlarını buraya ekleyin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tweets.map(tweet => (
                <TweetEmbed
                  key={tweet.id}
                  tweetId={tweet.id}
                  username={tweet.username}
                  onRemove={() => handleRemove(tweet.id)}
                  isDark={isDark}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
