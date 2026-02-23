import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function — TEFAS Reverse Proxy
 *
 * TEFAS API'si CORS kısıtlaması nedeniyle tarayıcıdan doğrudan çağrılamaz.
 * Bu fonksiyon:
 *   1. Frontend'den gelen POST isteğini alır
 *   2. Origin/Referer header'larını ekleyerek TEFAS'a yönlendirir
 *   3. Yanıtı frontend'e döndürür
 *
 * Endpoint: POST /api/tefas
 * Frontend çağrısı: fetch('/api/tefas', { method: 'POST', body: ... })
 */

const TEFAS_BASE = 'https://www.tefas.gov.tr/api/DB/BindHistoryInfo';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Body'yi string'e çevir — Vercel otomatik parse etmiş olabilir
    let body: string;
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && typeof req.body === 'object') {
      // URL-encoded form data olarak yeniden oluştur
      body = new URLSearchParams(req.body as Record<string, string>).toString();
    } else {
      return res.status(400).json({ error: 'Request body is required.' });
    }

    const response = await fetch(TEFAS_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://www.tefas.gov.tr',
        'Referer': 'https://www.tefas.gov.tr/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[TEFAS Proxy] Upstream error: ${response.status}`, errText.slice(0, 500));
      return res.status(response.status).json({
        error: `TEFAS API returned ${response.status}`,
        detail: errText.slice(0, 200),
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[TEFAS Proxy] Error:', msg);
    return res.status(502).json({ error: 'TEFAS proxy failed', detail: msg });
  }
}
