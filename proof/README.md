# Proof Artifacts — Bounty #55: Prediction Market Signal Aggregator

This directory contains real proxy-backed response samples per Issue #112 spec.

## Required files (3+ per endpoint)

### GET /api/prediction/signal
- `signal-bitcoin-2026-03.json` — BTC price target signal (Polymarket + Kalshi + Metaculus)
- `signal-fed-rates-2026-03.json` — Fed rate decision signal
- `signal-us-election-2026-03.json` — US election outcome signal

### GET /api/prediction/arbitrage
- `arbitrage-bitcoin-2026-03.json` — spread detection BTC across markets
- `arbitrage-fed-rates-2026-03.json`
- `arbitrage-election-2026-03.json`

### GET /api/prediction/markets
- `markets-list-2026-03.json` — paginated market listing with volume/liquidity

### GET /health
- `health-2026-03.json` — health check with wallet address

## Generation instructions
Once Proxies.sx port is active, set env vars and run:
```bash
PROXY_HOST=gate.proxies.sx PROXY_PORT=<PORT> PROXY_USER=<USER> PROXY_PASS=<PASS> \
  bun run scripts/gen-proof.ts --bounty=55
```

## Wallet
`WALLET_ADDRESS` = `A6M8icBwgDPwYhaWAjhJw267nbtkuivKH2q6sKPZgQEf` (read from `process.env.WALLET_ADDRESS`)
