export type PriceGapResult = {
  symbol: string;
  underlyingUsd: number;
  /** Ondo primary-market token price in USD (not comparable to spot without the multiplier). */
  ondoTokenUsd: number;
  impliedUsd: number;
  gapPct: number;
};

/** Stay under Vercel Hobby’s 10s function cap so we can return JSON instead of FUNCTION_INVOCATION_FAILED. */
const FETCH_TIMEOUT_MS = 8000;
const ONDO_ASSETS_TTL_MS = 5 * 60 * 1000;

/** Raw JSON text — do not JSON.parse the full body: each asset embeds a huge priceHistory24h array (~OOM on serverless). */
let ondoAssetsTextCache: { expires: number; text: string } | null = null;
let ondoAssetsInflight: Promise<string> | null = null;

function fetchTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

function getFinnhubToken(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error('FINNHUB_API_KEY is not set');
  }
  return key;
}

/**
 * Pull primary-market price + multiplier without parsing the full JSON tree (avoids multi‑MB object graphs on Vercel).
 * Matches Ondo’s current shape: "primaryMarket":{"symbol":"TICKERon","price":"…", ... "sharesMultiplier":"…"
 */
function parseImpliedFromOndoAssetsText(text: string, ondoSymbol: string): { price: string; sharesMultiplier: string } {
  const needle = `"primaryMarket":{"symbol":"${ondoSymbol}","price":"`;
  const i = text.indexOf(needle);
  if (i === -1) {
    throw new Error(`No Ondo primary market data for ${ondoSymbol}`);
  }
  const priceStart = i + needle.length;
  const priceEnd = text.indexOf('"', priceStart);
  if (priceEnd === -1) {
    throw new Error(`Invalid Ondo price field for ${ondoSymbol}`);
  }
  const price = text.slice(priceStart, priceEnd);
  const afterPrice = text.slice(priceEnd);
  const multMatch = afterPrice.match(/"sharesMultiplier":"([^"]+)"/);
  if (!multMatch) {
    throw new Error(`No sharesMultiplier for ${ondoSymbol}`);
  }
  return { price, sharesMultiplier: multMatch[1] };
}

async function fetchOndoAssetsText(): Promise<string> {
  const now = Date.now();
  if (ondoAssetsTextCache && ondoAssetsTextCache.expires > now) {
    return ondoAssetsTextCache.text;
  }
  if (ondoAssetsInflight) {
    return ondoAssetsInflight;
  }

  ondoAssetsInflight = (async () => {
    const res = await fetch('https://app.ondo.finance/api/v2/assets', {
      signal: fetchTimeoutSignal(),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OndoAnalytics/1.0',
      },
    });
    if (!res.ok) {
      throw new Error(`Ondo assets failed: ${res.status}`);
    }
    const text = await res.text();
    if (!text.includes('"assets"')) {
      throw new Error('Ondo response missing assets payload');
    }
    ondoAssetsTextCache = { expires: Date.now() + ONDO_ASSETS_TTL_MS, text };
    return text;
  })();

  try {
    return await ondoAssetsInflight;
  } finally {
    ondoAssetsInflight = null;
  }
}

export async function getUnderlyingPrice(symbol: string): Promise<number> {
  const token = getFinnhubToken();
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
    { signal: fetchTimeoutSignal() }
  );
  if (!res.ok) {
    throw new Error(`Finnhub quote failed: ${res.status}`);
  }
  const json = (await res.json()) as { c?: number };
  const price = json.c;
  if (price == null || Number.isNaN(price)) {
    throw new Error('Finnhub returned no price (c)');
  }
  return price;
}

async function getOndoTokenAndImpliedUsd(symbol: string): Promise<{ ondoTokenUsd: number; impliedUsd: number }> {
  const ondoSymbol = `${symbol}on`;
  const text = await fetchOndoAssetsText();
  const { price: priceStr, sharesMultiplier: multStr } = parseImpliedFromOndoAssetsText(text, ondoSymbol);

  const ondoTokenUsd = parseFloat(priceStr);
  const multiplier = parseFloat(multStr);
  if (!Number.isFinite(ondoTokenUsd) || !Number.isFinite(multiplier) || multiplier === 0) {
    throw new Error(`Invalid Ondo price/multiplier for ${ondoSymbol}`);
  }
  return { ondoTokenUsd, impliedUsd: ondoTokenUsd / multiplier };
}

export async function getImpliedPrice(symbol: string): Promise<number> {
  const { impliedUsd } = await getOndoTokenAndImpliedUsd(symbol);
  return impliedUsd;
}

export async function getPriceGap(symbol: string): Promise<PriceGapResult> {
  const [{ ondoTokenUsd, impliedUsd }, underlyingUsd] = await Promise.all([
    getOndoTokenAndImpliedUsd(symbol),
    getUnderlyingPrice(symbol),
  ]);

  if (underlyingUsd === 0) {
    throw new Error('Underlying price is zero; cannot compute gap');
  }

  const gapPct = ((impliedUsd - underlyingUsd) / underlyingUsd) * 100;

  return {
    symbol,
    underlyingUsd,
    ondoTokenUsd,
    impliedUsd,
    gapPct,
  };
}
