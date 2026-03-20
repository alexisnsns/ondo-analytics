**Ondo RWA analytics — tokenized stocks implied vs spot**

Compares live equity spot quotes (Finnhub) to Ondo’s RWA primary-market tokenized stocks prices and **implied USD per share** (token price ÷ shares-per-token dividend accrual), plus a mainnet **CoW Protocol** USDC sell quote for the same token adjusted with that multiplier.

- Symbol lookup with gap % vs spot for Ondo implied and CoW implied (when a quote exists)
- `lib/tokens.json` maps tickers → Ethereum mainnet ERC-20 addresses for CoW quotes

---

# Ondo mainnet token contracts

The lib folder holds the mapping used for CoW Protocol quotes: **ticker symbol → Ethereum mainnet ERC-20 contract address** for Ondo tokenized equities.

## Contributing

You can extend this list by editing `tokens.json`: add a new entry with the **uppercase** ticker as the key and the **checksummed or lowercase** `0x…` address as the value. Prefer verifying the contract on [Etherscan](https://etherscan.io/) (or your usual source) before opening a pull request.

Duplicate tickers are not valid JSON—each symbol should appear once.
