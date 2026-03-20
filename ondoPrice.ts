import 'dotenv/config';
import { getPriceGap } from './lib/ondoPrice';

const SYMBOL = process.argv[2] ?? 'SPY';

async function main() {
  const { underlyingUsd, ondoTokenUsd, impliedUsd, sharesMultiplier, cowswapUsd, ondoGapPct, cowswapGapPct } =
    await getPriceGap(SYMBOL);
  console.log(`Underlying:   $${underlyingUsd.toFixed(3)}`);
  console.log(`Ondo token:   $${ondoTokenUsd.toFixed(3)}`);
  console.log(`Shares/token: ${sharesMultiplier}`);
  console.log(`Implied/sh:   $${impliedUsd.toFixed(3)}`);
  console.log(`CoW /share:   ${cowswapUsd != null ? `$${cowswapUsd.toFixed(3)}` : '—'}`);
  console.log(`Gap Ondo spot: ${ondoGapPct.toFixed(4)}%`);
  console.log(`Gap CoW spot:  ${cowswapGapPct != null ? `${cowswapGapPct.toFixed(4)}%` : '—'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
