import { useCallback, useEffect, useState } from 'react';

type ApiOk = {
  symbol: string;
  underlyingUsd: number;
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
    const snippet = text.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(
      `Not JSON (${res.status}): ${snippet}${text.length > 160 ? '…' : ''}`
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
        <h1>Ondo implied vs spot</h1>
        <p className="lede">
          Underlying quote (Finnhub) vs Ondo primary-market implied per share.
        </p>
      </header>

      <section className="controls">
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
      </section>

      <section className={statusClass} aria-live="polite">
        {statusText}
      </section>

      {data ? (
        <ul className="metrics">
          <li>
            <span className="k">Spot</span>
            <span className="v">{fmtUsd(data.underlyingUsd)}</span>
          </li>
          <li>
            <span className="k">Implied</span>
            <span className="v">{fmtUsd(data.impliedUsd)}</span>
          </li>
          <li>
            <span className="k">Gap</span>
            <span className={`v${data.gapPct >= 0 ? ' pos' : ' neg'}`}>{fmtPct(data.gapPct)}</span>
          </li>
        </ul>
      ) : null}
    </main>
  );
}
