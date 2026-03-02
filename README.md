# RAI Dashboard

> Production-grade, security-conscious, **read-only** web dashboard for the Republic/RAI network.

![Node.js](https://img.shields.io/badge/Node.js-22-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## 🎯 Purpose

RAI Dashboard provides a lightweight, self-hosted web interface to monitor your Republic validator node. It displays real-time block height, peer count, sync status, and supports wallet balance & delegation queries — all without exposing private keys or sensitive endpoints.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│ Internet                                         │
│  ┌────────────────────┐                          │
│  │ Caddy Reverse Proxy│ ← TLS + Basic Auth       │
│  │ :443               │                          │
│  └────────┬───────────┘                          │
│           │                                      │
│  ┌────────▼───────────┐     ┌──────────────────┐ │
│  │ Express App (Docker)│────▶│ Republic Node RPC│ │
│  │ 127.0.0.1:3001     │     │ 127.0.0.1:43657  │ │
│  └────────────────────┘     └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 🔒 Security

- **Localhost-only binding** — App never exposes ports to public network directly
- **Caddy reverse proxy** — TLS termination + Basic Auth + security headers
- **Helmet** — HTTP security headers (CSP, HSTS, etc.)
- **Rate limiting** — Configurable request rate limits per IP
- **Input validation** — Bech32 address format validation (rai1... / raivaloper1...)
- **SSRF prevention** — No user-supplied RPC URLs; hardcoded localhost only
- **No file uploads** — Request body limited to 8KB
- **Docker hardening** — Non-root user, read-only filesystem, dropped capabilities

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/node/status` | Block height, time, sync status |
| `GET` | `/api/node/peers` | Connected peer count |
| `GET` | `/api/wallet/:address/balance` | Wallet balance (RAI & arai) |
| `GET` | `/api/wallet/:address/delegation/:valoper` | Delegation to specific validator |

## ⚡ Quick Start

### Prerequisites
- Node.js 22+
- Republic node running locally with RPC on port 43657
- `republicd` CLI available in PATH

### Development

```bash
# Install dependencies
npm install

# Copy env config
cp .env.example .env

# Start in development mode
npm run dev
```

### Production (Docker)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f rai-dashboard
```

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_HTTP_URL` | `http://127.0.0.1:43657` | Local RPC HTTP endpoint |
| `RPC_NODE_URL` | `tcp://127.0.0.1:43657` | Local RPC TCP endpoint (for CLI) |
| `CHAIN_ID` | `raitestnet_77701-1` | Chain identifier |
| `DEFAULT_VALOPER` | *(empty)* | Default validator operator address |
| `PORT` | `3000` | Application port |
| `CORS_ORIGINS` | *(same-origin)* | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |

## 📁 Project Structure

```
rai-dashboard/
├── src/
│   ├── server.ts    # Express entry point (helmet, cors, rate-limit)
│   ├── api.ts       # API router
│   ├── rpc.ts       # RPC fetch helpers (SSRF-safe)
│   └── cli.ts       # Safe execFile wrapper for republicd
├── web/
│   ├── index.html   # Dashboard frontend
│   └── app.js       # Frontend JavaScript
├── Dockerfile       # Multi-stage Docker build
├── docker-compose.yml
├── Caddyfile        # Reverse proxy config
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 📜 License

MIT — see [LICENSE](./LICENSE) for details.
