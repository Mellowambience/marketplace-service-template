# Proof Artifacts — Bounty #70: Trend Intelligence API

This directory contains real proxy-backed response samples per Issue #112 spec.

## Required files (3+ per endpoint)

### GET /api/trends/signals
- `signals-bitcoin-2026-03.json` — trend signals for bitcoin topic
- `signals-ai-coding-2026-03.json` — trend signals for AI coding assistants topic
- `signals-fed-rates-2026-03.json` — trend signals for Federal Reserve rates topic

### GET /api/trends/topic/:id
- `topic-bitcoin-detail-2026-03.json` — deep-dive with velocity + sentiment
- `topic-ai-coding-detail-2026-03.json`
- `topic-fed-rates-detail-2026-03.json`

### GET /api/trends/arbitrage
- `arbitrage-bitcoin-2026-03.json` — cross-platform divergence (trending on Reddit, not on X)
- `arbitrage-ai-coding-2026-03.json`

### POST /api/research
- `research-bitcoin-2026-03.json` — full synthesis result
- `research-ai-coding-2026-03.json`
- `research-climate-2026-03.json`

## Generation instructions
Once Proxies.sx port is active, set env vars and run:
```bash
PROXY_HOST=gate.proxies.sx PROXY_PORT=<PORT> PROXY_USER=<USER> PROXY_PASS=<PASS> \
  bun run scripts/gen-proof.ts --bounty=70
```

## Wallet
`WALLET_ADDRESS` = `A6M8icBwgDPwYhaWAjhJw267nbtkuivKH2q6sKPZgQEf` (read from `process.env.WALLET_ADDRESS`)
