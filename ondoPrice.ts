import 'dotenv/config';
import { getPriceGap } from './lib/ondoPrice';

const SYMBOL = process.argv[2] ?? 'SPY';

async function main() {
  const { underlyingUsd, ondoTokenUsd, impliedUsd, gapPct } = await getPriceGap(SYMBOL);
  console.log(`Underlying:   $${underlyingUsd.toFixed(3)}`);
  console.log(`Ondo token:   $${ondoTokenUsd.toFixed(3)}`);
  console.log(`Implied/sh:   $${impliedUsd.toFixed(3)}`);
  console.log(`Gap:          ${gapPct.toFixed(4)}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
