import { useCallback, useEffect, useState } from 'react';

type ApiOk = {
  symbol: string;
  underlyingUsd: number;
  ondoTokenUsd: number;
  impliedUsd: number;
  gapPct: number;
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

function fmtPct(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(4)}%`;
}

function gapInterpretation(symbol: string, gapPct: number) {
  const label = `${symbol} tokenized stock price on Ondo`;
  const tail = 'its equivalent spot price in financial markets';
  const eps = 1e-9;
  if (Math.abs(gapPct) < eps) {
    return `${label} matches ${tail}.`;
  }
  const dir = gapPct > 0 ? 'more expensive' : 'cheaper';
  const pct = Math.abs(gapPct).toFixed(4);
  return `${label} is ${pct}% ${dir} than ${tail}.`;
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

  const statusText = loading ? 'Loading…' : error ?? (data ? `Updated · ${data.symbol}on` : '');

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
          price is not directly comparable to the underlying equity without the shares multiplier. Implied USD per share
          is Ondo’s primary-market token price divided by that multiplier; the gap uses implied per share vs. the Finnhub
          live quote for the selected ticker.
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

      <section className={statusClass} aria-live="polite">
        {statusText}
      </section>

      {data ? (
        <>
          <p className="metric-hint">
            Implied per share = Ondo primary token price ÷ shares per token.
          </p>
          <ul className="metrics">
            <li>
              <span className="k">Spot (reference)</span>
              <span className="v">{fmtUsd(data.underlyingUsd)}</span>
            </li>
            <li>
              <span className="k">Ondo token (primary)</span>
              <span className="v">{fmtUsd(data.ondoTokenUsd)}</span>
            </li>
            <li>
              <span className="k">Implied price per share</span>
              <span className="v">{fmtUsd(data.impliedUsd)}</span>
            </li>
            <li>
              <span className="k">Gap</span>
              <span className={`v${data.gapPct >= 0 ? ' pos' : ' neg'}`}>{fmtPct(data.gapPct)}</span>
            </li>
          </ul>
          <p className="interpret">{gapInterpretation(data.symbol, data.gapPct)}</p>
        </>
      ) : null}
    </main>
  );
}
