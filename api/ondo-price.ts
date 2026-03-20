import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPriceGap } from '../lib/ondoPrice.js';

/** Pro / Enterprise: raise if you still hit timeouts (Hobby max is 10s). */
export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.toUpperCase() : 'SPY';

  try {
    const data = await getPriceGap(symbol);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
