# Ondo mainnet token contracts

The lib folder holds the mapping used for CoW Protocol quotes: **ticker symbol → Ethereum mainnet ERC-20 contract address** for Ondo tokenized equities.

## Contributing

You can extend this list by editing `tokens.json`: add a new entry with the **uppercase** ticker as the key and the **checksummed or lowercase** `0x…` address as the value. Prefer verifying the contract on [Etherscan](https://etherscan.io/) (or your usual source) before opening a pull request.

Duplicate tickers are not valid JSON—each symbol should appear once.
