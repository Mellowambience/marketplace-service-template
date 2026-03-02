# Proof Artifacts — Bounty #53: Mobile Ad Verification & Creative Intelligence

This directory contains real proxy-backed response samples per Issue #112 spec.

## Required files (3+ per endpoint)

### GET /api/ads/verify
- `verify-meta-feed-us-2026-03.json` — Meta feed placement, US geo
- `verify-meta-stories-us-2026-03.json` — Meta stories placement, US geo
- `verify-google-search-us-2026-03.json` — Google search ad, US geo

### GET /api/ads/library
- `library-meta-fashion-2026-03.json` — Meta ad library, fashion category
- `library-meta-fintech-2026-03.json` — Meta ad library, fintech category
- `library-google-finance-2026-03.json` — Google ads, finance category

### GET /health
- `health-2026-03.json` — health check response confirming wallet address

## Generation instructions
Once Proxies.sx port is active, set env vars and run:
```bash
PROXY_HOST=gate.proxies.sx PROXY_PORT=<PORT> PROXY_USER=<USER> PROXY_PASS=<PASS> \
  bun run scripts/gen-proof.ts --bounty=53
```

## Wallet
`WALLET_ADDRESS` = `A6M8icBwgDPwYhaWAjhJw267nbtkuivKH2q6sKPZgQEf` (read from `process.env.WALLET_ADDRESS`)
