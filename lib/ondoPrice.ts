export type PriceGapResult = {
  symbol: string;
  underlyingUsd: number;
  impliedUsd: number;
  gapPct: number;
};

function getFinnhubToken(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error('FINNHUB_API_KEY is not set');
  }
  return key;
}

export async function getUnderlyingPrice(symbol: string): Promise<number> {
  const token = getFinnhubToken();
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`
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

export async function getImpliedPrice(symbol: string): Promise<number> {
  const res = await fetch('https://app.ondo.finance/api/v2/assets');
  if (!res.ok) {
    throw new Error(`Ondo assets failed: ${res.status}`);
  }
  const json = (await res.json()) as { assets?: Array<{ symbol: string; primaryMarket?: { price?: string; sharesMultiplier?: string } }> };
  const assets = json.assets;
  if (!Array.isArray(assets)) {
    throw new Error('Ondo response missing assets[]');
  }

  const assetMap = Object.fromEntries(assets.map((a) => [a.symbol, a]));
  const ondoSymbol = `${symbol}on`;
  const asset = assetMap[ondoSymbol];
  const priceStr = asset?.primaryMarket?.price;
  const multStr = asset?.primaryMarket?.sharesMultiplier;
  if (!priceStr || !multStr) {
    throw new Error(`No Ondo primary market data for ${ondoSymbol}`);
  }

  const price = parseFloat(priceStr);
  const multiplier = parseFloat(multStr);
  if (!Number.isFinite(price) || !Number.isFinite(multiplier) || multiplier === 0) {
    throw new Error(`Invalid Ondo price/multiplier for ${ondoSymbol}`);
  }
  return price / multiplier;
}

export async function getPriceGap(symbol: string): Promise<PriceGapResult> {
  const [impliedUsd, underlyingUsd] = await Promise.all([
    getImpliedPrice(symbol),
    getUnderlyingPrice(symbol),
  ]);

  if (underlyingUsd === 0) {
    throw new Error('Underlying price is zero; cannot compute gap');
  }

  const gapPct = ((impliedUsd - underlyingUsd) / underlyingUsd) * 100;

  return {
    symbol,
    underlyingUsd,
    impliedUsd,
    gapPct,
  };
}
