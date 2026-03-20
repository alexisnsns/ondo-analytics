/** CoW Protocol (Cowswap) mainnet — on-chain USDC sell quote for Ondo tokens. */

import ondoMainnetTokens from './ondo-mainnet-tokens/tokens.json' with { type: 'json' };

const FETCH_TIMEOUT_MS = 8000;

const USDC_MAINNET = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const COW_QUOTE_URL = 'https://api.cow.fi/mainnet/api/v1/quote';
/** CoW requires a `from` field; quotes work with a placeholder address. */
const QUOTE_FROM = '0x0000000000000000000000000000000000000001';

/** Ethereum mainnet ERC-20 for Ondo tokenized tickers — see `ondo-mainnet-tokens/`. */
const ONDO_MAINNET_TOKEN = ondoMainnetTokens as Record<string, `0x${string}`>;

/** Ondo tokenized equities use 18 decimals on mainnet (matches CoW quote atomic math). */
const ONDO_DECIMALS = 18;
const USDC_DECIMALS = 6;

function fetchTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

type CowQuoteOk = {
  quote: {
    sellAmount: string;
    buyAmount: string;
  };
};

/**
 * USDC per 1 Ondo token from a CoW sell quote (1 full token → USDC).
 * For per-share comparability with Ondo implied, divide by Ondo’s `sharesMultiplier`.
 */
export async function getCowswapUsdPerOndoToken(symbol: string): Promise<number | null> {
  const sellToken = ONDO_MAINNET_TOKEN[symbol.toUpperCase()];
  if (!sellToken) {
    return null;
  }

  const sellAmountBeforeFee = 10n ** BigInt(ONDO_DECIMALS);

  const res = await fetch(COW_QUOTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sellToken: sellToken.toLowerCase(),
      buyToken: USDC_MAINNET,
      sellAmountBeforeFee: sellAmountBeforeFee.toString(),
      kind: 'sell',
      from: QUOTE_FROM,
    }),
    signal: fetchTimeoutSignal(),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Cowswap quote HTTP ${res.status}: ${raw.slice(0, 120)}`);
  }

  let json: CowQuoteOk;
  try {
    json = JSON.parse(raw) as CowQuoteOk;
  } catch {
    throw new Error('Cowswap quote: invalid JSON');
  }

  const q = json.quote;
  if (!q?.buyAmount || !q?.sellAmount) {
    throw new Error('Cowswap quote: missing amounts');
  }

  const buyUsdc = Number(q.buyAmount) / 10 ** USDC_DECIMALS;
  const sold = Number(q.sellAmount) / 10 ** ONDO_DECIMALS;
  if (!Number.isFinite(buyUsdc) || !Number.isFinite(sold)) {
    throw new Error('Cowswap quote: non-finite amounts');
  }
  return sold > 0 ? buyUsdc / sold : buyUsdc;
}
