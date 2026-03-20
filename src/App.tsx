import { useCallback, useEffect, useState } from 'react';

type ApiOk = {
  symbol: string;
  underlyingUsd: number;
  ondoTokenUsd: number;
  impliedUsd: number;
  sharesMultiplier: number;
  cowswapUsd?: number | null;
  ondoGapPct: number;
  cowswapGapPct: number | null;
};

type ApiErr = { error: string };

async function readApiBody(res: Response): Promise<ApiOk | ApiErr> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      'Empty response from /api. If you use `npm run dev`, run `npx vercel dev --listen 3000` in another terminal so the Vite proxy can reach the API.'
    );
  }
  try {
    return JSON.parse(text) as ApiOk | ApiErr;
  } catch {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 220);
    if (snippet.includes('FUNCTION_INVOCATION_FAILED')) {
      throw new Error(
        'Serverless invocation failed (often timeout or crash). Check Vercel logs; on Hobby, functions are capped at 10s. Retry or upgrade plan if the Ondo assets request is slow.'
      );
    }
    throw new Error(
      `Not JSON (${res.status}): ${snippet}${text.length > 220 ? '…' : ''}`
    );
  }
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 3,
  }).format(n);
}

function fmtShares(n: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(4)}%`;
}

function ondoGapInterpretation(symbol: string, gapPct: number) {
  const label = `${symbol} tokenized stock price on Ondo (adjusted per share)`;
  const tail = 'the Finnhub spot quote';
  const eps = 1e-9;
  if (Math.abs(gapPct) < eps) {
    return `${label} matches ${tail}.`;
  }
  const dir = gapPct > 0 ? 'more expensive' : 'cheaper';
  const pct = Math.abs(gapPct).toFixed(4);
  return `${label} is ${pct}% ${dir} than ${tail}.`;
}

function cowswapGapInterpretation(symbol: string, gapPct: number | null) {
  if (gapPct == null) {
    return `CoW implied per-share vs spot is unavailable (no mainnet quote for ${symbol} in our map).`;
  }
  const label = `CoW implied per-share value for ${symbol}on`;
  const tail = 'the Finnhub spot quote';
  const eps = 1e-9;
  if (Math.abs(gapPct) < eps) {
    return `${label} matches ${tail}.`;
  }
  const dir = gapPct > 0 ? 'above' : 'below';
  const pct = Math.abs(gapPct).toFixed(4);
  return `${label} is ${pct}% ${dir} ${tail}.`;
}

export function App() {
  const [symbol, setSymbol] = useState('SPY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  const load = useCallback(async () => {
    const s = symbol.trim().toUpperCase() || 'SPY';
    setSymbol(s);
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const q = new URLSearchParams({ symbol: s });
      const res = await fetch(`/api/ondo-price?${q}`);
      const body = await readApiBody(res);

      if (!res.ok || 'error' in body) {
        const msg = 'error' in body ? body.error : res.statusText;
        throw new Error(msg || `HTTP ${res.status}`);
      }

      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
    // Initial fetch only; further loads via Refresh / Enter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusClass =
    loading ? 'status loading' : error ? 'status err' : data ? 'status ok' : 'status';

  const statusText = error ?? (data ? `Updated · ${data.symbol}on` : '');

  return (
    <main className="shell">
      <header className="head">
        <h1 className="head-title">
          <span className="head-title-line">Ondo tokenized stocks</span>
          <span className="head-title-line head-title-line--sub">Implied vs spot price</span>
        </h1>

        <p className="lede">
          Comparison of the live underlying spot quote to Ondo’s primary-market token price and implied USD per share.
        </p>
        <p className="explain">
          Ondo tokenized stocks accrue dividends through an increasing shares-per-token ratio, so the token’s dollar
          price is not directly comparable to the underlying equity without the shares multiplier. 
          </p>
          <p className="explain">
          Implied USD per share
          is Ondo’s primary-market token price divided by that multiplier. 
          </p>
          <p className="explain"> 
      The CoW quote is a mainnet USDC sell quote via the{' '}
          <a href="https://docs.cow.fi/" target="_blank" rel="noopener noreferrer">
            CoW Protocol
          </a>{' '}
          API, adjusted with the same Ondo shares-per-token figure.
        </p>
      </header>

      <section className="controls">
        <p className="symbol-hint">
          Try with QQQ, TSLA, or AAPL — full list of tokenized Ondo stocks available on{' '}
          <a href="https://app.ondo.finance/" target="_blank" rel="noopener noreferrer">
            app.ondo.finance
          </a>
          . Geographic restrictions apply.
        </p>
        <div className="controls-row">
          <label className="field">
            <span className="label">Symbol</span>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load();
              }}
              maxLength={12}
              autoComplete="off"
            />
          </label>
          <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </section>

      <section className={statusClass} aria-live="polite" aria-busy={loading}>
        {loading ? (
          <span className="status-loading">
            <span className="spinner" aria-hidden />
            <span className="sr-only">Loading</span>
          </span>
        ) : (
          statusText
        )}
      </section>

      {data ? (
        <>
          <p className="metric-hint">
            Implied per share = Ondo primary token price ÷ shares per token.
            </p>
            
            <p className="metric-hint">
              
             CoW per share = USDC quote per token ÷ shares
            per token.
          </p>
          <ul className="metrics">
            <li>
              <span className="k">Spot (tradFi reference)</span>
              <span className="v">{fmtUsd(data.underlyingUsd)}</span>
            </li>
            <li>
              <span className="k">Ondo token (mint price)</span>
              <span className="v">{fmtUsd(data.ondoTokenUsd)}</span>
            </li>
            <li>
              <span className="k">Shares per token (SPT)</span>
              <span className="v">{fmtShares(data.sharesMultiplier)}</span>
            </li>
            <li>
              <span className="k">Implied mint price per share</span>
              <span className="v">{fmtUsd(data.impliedUsd)}</span>
            </li>
            <li>
              <span className="k">Gap (Ondo implied mint vs spot price)</span>
              <span className={`v${data.ondoGapPct >= 0 ? ' pos' : ' neg'}`}>
                {fmtPct(data.ondoGapPct)}
              </span>
            </li>
            <li>
              <span className="k">CoW Swap price (SPT adjusted)</span>
              <span className={data.cowswapUsd != null ? 'v' : 'v na'}>
                {data.cowswapUsd != null ? fmtUsd(data.cowswapUsd) : '—'}
              </span>
            </li>
         
            <li>
              <span className="k">Gap (CoW vs spot)</span>
              <span
                className={
                  data.cowswapGapPct == null ? 'v na' : `v${data.cowswapGapPct >= 0 ? ' pos' : ' neg'}`
                }
              >
                {data.cowswapGapPct != null ? fmtPct(data.cowswapGapPct) : '—'}
              </span>
            </li>
          </ul>
          <p className="interpret">{ondoGapInterpretation(data.symbol, data.ondoGapPct)}</p>
          <p className="interpret">{cowswapGapInterpretation(data.symbol, data.cowswapGapPct ?? null)}</p>
        </>
      ) : null}

      <footer className="site-footer">
        <p>
          <a
            href="https://github.com/alexisnsns/ondo-analytics"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {' — '}open to contributions.
        </p>
        <p>
          Support:{' '}
          <a href="mailto:hello@alexn.me">hello@alexn.me</a>
        </p>
      </footer>
    </main>
  );
}
