// ─── Technical Analysis Engine ────────────────────────────
// Implements Smoothed RSI (Wilder's Smoothing) and SMA

export interface TechnicalSignal {
  symbol: string;
  rsi14: number | null;
  sma7: number | null;
  sma14: number | null;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  label: string; // human-readable Turkish summary
}

/**
 * Wilder's Smoothed RSI (standard RSI-14).
 * Uses simple average for first period, then Wilder's smoothing (EMA with α=1/period).
 * Requires at least period+1 data points.
 */
export function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Seed: simple average of first `period` gains and losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining changes
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Simple Moving Average over last `period` prices.
 */
export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return parseFloat((sum / period).toFixed(4));
}

/**
 * Build a composite TechnicalSignal for a symbol given its daily close prices.
 */
export function buildTechnicalSignal(symbol: string, prices: number[]): TechnicalSignal {
  const rsi14 = calculateRSI(prices, 14);
  const sma7 = calculateSMA(prices, 7);
  const sma14 = calculateSMA(prices, 14);

  let signal: TechnicalSignal['signal'] = 'NEUTRAL';
  const parts: string[] = [];

  // RSI signal
  if (rsi14 !== null) {
    if (rsi14 > 70) {
      signal = 'SELL';
      parts.push(`RSI(14)=${rsi14} → Aşırı Alım`);
    } else if (rsi14 < 30) {
      signal = 'BUY';
      parts.push(`RSI(14)=${rsi14} → Aşırı Satım`);
    } else {
      parts.push(`RSI(14)=${rsi14} → Nötr`);
    }
  }

  // SMA crossover signal
  if (sma7 !== null && sma14 !== null) {
    const diff = ((sma7 - sma14) / sma14) * 100;
    if (diff > 0.5) {
      parts.push('SMA7>SMA14 → Kısa vadeli yükseliş');
      if (signal === 'NEUTRAL') signal = 'BUY';
    } else if (diff < -0.5) {
      parts.push('SMA7<SMA14 → Kısa vadeli düşüş');
      if (signal === 'NEUTRAL') signal = 'SELL';
    } else {
      parts.push('SMA7≈SMA14 → Yatay trend');
    }
  }

  const label = parts.length > 0 ? parts.join(' | ') : 'Yeterli veri yok';

  return { symbol, rsi14, sma7, sma14, signal, label };
}

/**
 * Format technical signals for inclusion in Claude prompt.
 */
export function formatSignalsForPrompt(signals: TechnicalSignal[]): string {
  if (signals.length === 0) return '';

  const lines = signals.map(s => `  - ${s.symbol}: ${s.label}`).join('\n');

  return `TEKNİK ANALİZ SİNYALLERİ (son 14 günlük günlük veri):
${lines}

PORTFÖY AĞIRLANDIRMA KURALI:
  - RSI > 70 olan varlıkların ağırlığını düşür (aşırı alım riski)
  - RSI < 30 olan varlıklara dikkatli yaklaş (fırsat olabilir, momentum devam edebilir)
  - SMA7 > SMA14 olan varlıklar kısa vadeli momentum açısından daha güçlü`;
}
