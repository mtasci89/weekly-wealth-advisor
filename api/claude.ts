import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function — Claude API Proxy
 *
 * Tarayıcıdan Anthropic API'ye direkt çağrı CORS sorununa takılabiliyor.
 * Bu fonksiyon server-side proxy olarak çalışır:
 *   1. Frontend'den gelen isteği alır (API key header'da veya body'de)
 *   2. Server-side'dan Anthropic API'yi çağırır
 *   3. Yanıtı frontend'e döndürür
 *
 * Endpoint: POST /api/claude
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // API key'i header'dan al
    const apiKey =
      (req.headers['x-api-key'] as string) || '';

    if (!apiKey) {
      return res.status(401).json({ error: 'x-api-key header is required.' });
    }

    // Body'yi olduğu gibi Anthropic'e forward et
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    // Response header'larını kopyala
    const responseData = await response.text();

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    return res.send(responseData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Claude Proxy] Error:', msg);
    return res.status(502).json({ error: 'Claude proxy failed', detail: msg });
  }
}
