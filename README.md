# BlockVote — Decentralized Voting on Ethereum

A tamper-evident voting system where every ballot is recorded as a state change on an Ethereum smart contract. Voters are bound to specific Ethereum addresses, eligibility is whitelisted per election by an admin, and the entire flow can be run locally on Ganache or hosted live on Railway.

> **Live deployment:** https://blockvote-production.up.railway.app — Ganache RPC at https://blockvote-chain-production.up.railway.app

---

## Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Local Setup](#local-setup)
- [MetaMask Configuration](#metamask-configuration)
- [Workflow](#workflow)
- [Smart Contract API](#smart-contract-api)
- [Backend API](#backend-api)
- [Frontend Theming](#frontend-theming)
- [Live Deployment (Railway)](#live-deployment-railway)
- [npm Scripts](#npm-scripts)
- [License](#license)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Solidity ^0.5.15 |
| Blockchain | Ethereum (Ganache — local or Railway-hosted) |
| Frontend | HTML5, CSS3 (terminal aesthetic + paper-terminal light mode), Vanilla JS, jQuery |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JSON Web Tokens (JWT) + Ethereum address binding |
| Wallet | MetaMask |
| Build | Truffle, Browserify |
| Deployment | Docker on Railway, persistent volume for chain state |

---

## Project Structure

```
BlockVote/
├── blockchain/
│   ├── contracts/
│   │   ├── Voting.sol              # Multi-election contract w/ eligibility + onlyOwner
│   │   └── Migrations.sol
│   ├── migrations/
│   ├── build/contracts/            # Compiled ABI + deployed addresses (committed)
│   └── truffle-config.js           # Networks: development + production
│
├── backend/
│   ├── server.js                   # Express, mounts /admin + auth routers
│   ├── db/
│   │   ├── database.js             # SQLite schema (voters table w/ eth_address)
│   │   └── seed.js                 # Seeds the admin account only
│   ├── routes/
│   │   ├── auth.js                 # GET /login → JWT + bound eth_address
│   │   └── admin.js                # GET/POST/DELETE /admin/voter*
│   └── middleware/
│       └── auth.js                 # authorizeUser, authorizeApi, requireAdmin
│
├── frontend/
│   ├── html/                       # login.html, index.html, admin.html
│   ├── css/                        # Terminal aesthetic w/ light-theme overrides
│   ├── js/
│   │   ├── login.js                # Login form, persists bound eth_address
│   │   └── app.js                  # Web3, voter registry, eligibility, vote
│   └── dist/                       # Bundled JS (gitignored, built by Docker)
│
├── docs/
│   ├── architecture.md             # Diagrams + flows
│   ├── code-explained.md           # File-by-file walkthrough
│   ├── project-explained.md        # Narrative project overview
│   └── how-to-run.txt              # Quick command reference
│
├── Dockerfile                      # Node + Express + frontend service
├── Dockerfile.ganache              # Ganache chain service (--deterministic)
├── .env                            # SECRET_KEY, MNEMONIC, PRODUCTION_RPC_URL (gitignored)
└── package.json
```

---

## How It Works

BlockVote splits responsibility between three layers:

1. **SQLite + Express** — stores `voter_id` / `password` / `role` / `eth_address`. Issues a JWT on successful login. Acts as the *who-am-I* check, not the *can-I-vote* check.
2. **MetaMask** — the user's Ethereum wallet. Signs transactions. The connected wallet address must match the `eth_address` registered for the logged-in voter (enforced by the frontend at page load).
3. **Voting.sol on Ethereum** — the source of truth for everything that matters: which elections exist, which addresses are whitelisted per election, who voted for whom. Anyone with chain access can verify the tally.

The off-chain database is a convenience for human-friendly login. The contract is the system of record.

### Why split off-chain auth from on-chain voting?

- **Privacy**: The voter's name/email never touches the public chain.
- **UX**: Voters log in with familiar credentials, not a 32-character private key.
- **Integrity**: Even with full DB access, you cannot rewrite a vote — the chain's signature trail and the per-address eligibility check make ballot stuffing infeasible.

---

## Local Setup

### Prerequisites (one-time)

```bash
npm install -g truffle ganache
npm install
```

### 1. Start Ganache (Terminal 1)

```bash
ganache --port 8545 --networkId 1337 --deterministic
```

`--deterministic` gives the same 10 accounts every restart. Account 0 (`0x90F8…c9C1`) becomes the admin/deployer.

### 2. Deploy the contract (Terminal 2)

```bash
cd blockchain
truffle migrate --reset
cd ..
```

### 3. Bundle the frontend

```bash
npm run bundle
```

### 4. Seed the database (first time only)

```bash
npm run seed
```

This inserts only the `admin` account, bound to `0x90F8…c9C1`. All other voters are added through the admin UI.

### 5. Start the server

```bash
npm start
```

Open **http://localhost:8080**.

---

## MetaMask Configuration

Add a custom network:

| Field | Value (local) | Value (Railway) |
|-------|---------------|-----------------|
| Network Name | Ganache (local) | BlockVote Chain |
| RPC URL | `http://127.0.0.1:8545` | `https://blockvote-chain-production.up.railway.app` |
| Chain ID | `1337` | `1337` |
| Currency Symbol | ETH | ETH |

**Import the admin account** (Account → Import account → Private Key):

```
0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d
```

The full list of 10 deterministic accounts is in [docs/project-explained.md](docs/project-explained.md#deterministic-accounts).

---

## Workflow

### Admin

1. Log in as `admin / admin123` with MetaMask on the deployer account
2. **Voter Registry** — register each voter with their `voter_id`, password, and Ethereum address. Each voter's address must be unique.
3. **Create Election** — name the election. Stored on-chain.
4. Select the election from the tab row.
5. **Add Candidates** — name and party. Each is a smart-contract transaction.
6. **Set Voting Period** — start and end dates (interpreted as UTC midnight).
7. **Eligible Voters** — for each registered voter, click `[ whitelist ]` to add them to this election's whitelist. Each click is a contract call.

### Voter

1. Log in as `voter1 / pass1` (or whichever ID was registered)
2. Switch MetaMask to the address registered for that voter — the page will block voting if the address doesn't match
3. Approve the MetaMask connection prompt
4. The page shows only elections you've been whitelisted for
5. Select a candidate → click **Cast Vote on Blockchain** → sign the transaction in MetaMask
6. Vote tally updates after confirmation; the same voter can't vote again in that election (enforced on-chain)

> One Ethereum address gets one vote per election. Because each voter is bound to one address, this means one BlockVote login = one vote per election.

---

## Smart Contract API

`blockchain/contracts/Voting.sol`

| Function | Caller | Description |
|----------|--------|-------------|
| `createElection(name)` | `onlyOwner` | Create a new named election |
| `addCandidate(electionId, name, party)` | `onlyOwner` | Add a candidate to an election |
| `setDates(electionId, start, end)` | `onlyOwner` | Set voting period (Unix timestamps) |
| `addEligibleVoter(electionId, address)` | `onlyOwner` | Whitelist an address for an election |
| `vote(electionId, candidateId)` | any whitelisted address | Cast one vote in an election |
| `checkVote(electionId)` | anyone | Has caller voted in this election? |
| `isEligible(electionId, address)` | anyone | Is the given address whitelisted? |
| `getElection(id)` | anyone | Returns name, dates, candidate count |
| `getCandidate(electionId, candidateId)` | anyone | Returns name, party, vote count |
| `getCountElections()` | anyone | Total number of elections |
| `getCountCandidates(electionId)` | anyone | Candidates in this election |
| `getEligibleVoterCount(electionId)` | anyone | Whitelisted addresses in this election |

**`vote()` enforces six guards**, each reverting on failure:

1. Election ID exists
2. `msg.sender` is in `eligibleVoters[electionId]`
3. Voting period has been set
4. Current `block.timestamp` is within `[startDate, endDate)`
5. Candidate ID exists in this election
6. `msg.sender` has not already voted in this election

---

## Backend API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/login?voter_id=&password=` | none | Returns `{ token, role, eth_address }` on match |
| GET | `/admin/voters` | JWT (admin) | List registered voters |
| POST | `/admin/voter` | JWT (admin) | Register voter `{ voter_id, password, eth_address }` |
| DELETE | `/admin/voter/:voter_id` | JWT (admin) | Remove voter (cannot delete `admin`) |
| GET | `/index.html` | JWT (any) | Serve voter page |
| GET | `/admin.html` | JWT (any) | Serve admin page |
| GET | `/`, `/css/:f`, `/js/:f`, `/dist/:f` | none | Static assets |

JWT can be passed as `?Authorization=Bearer <token>` (page loads) or `Authorization: Bearer <token>` header (API calls).

---

## Frontend Theming

Two themes, toggled by the `[ ☀ ]` / `[ ☾ ]` button in each page's header (or top-right corner on the login page):

- **Dark (default)** — phosphor green + amber on near-black, with subtle CRT scanlines
- **Light (paper-terminal)** — deep forest green on cream, scanlines disabled

Both share the same JetBrains Mono typography, ASCII frame motifs (`// section.name`, `[ button ]`, `> prompt`), and box layout. Theme choice persists in `localStorage` as `bvtheme` and is applied inline in `<head>` to avoid flash-of-wrong-theme on reload.

---

## Live Deployment (Railway)

The project ships with two Dockerfiles for [Railway](https://railway.app):

- **`Dockerfile`** — Node 20 + Express + frontend bundle, binds to `$PORT`
- **`Dockerfile.ganache`** — Ganache 7.9.2 with `--deterministic --db /data/chain` for persistent state across restarts

**Two Railway services**, one project:

| Service | Dockerfile | Volume | Public URL |
|---------|------------|--------|------------|
| `blockvote-chain` | `Dockerfile.ganache` | `/data` (1 GB) | `…-chain-production.up.railway.app` |
| `blockvote-app` | `Dockerfile` | none | `…-production.up.railway.app` |

**Required env vars on `blockvote-app`:**

- `SECRET_KEY` — anything random, used for JWT signing

**Deploying a new contract from your local machine to Railway:**

1. `npm i -D @truffle/hdwallet-provider`
2. In `.env`: `MNEMONIC="myth like bonus scare …"` (deterministic Ganache) and `PRODUCTION_RPC_URL=https://blockvote-chain-production.up.railway.app`
3. `cd blockchain && truffle migrate --network production --reset`
4. `npm run bundle`
5. Commit `blockchain/build/contracts/Voting.json` and push — Railway auto-rebuilds the app service with the new contract address baked in

---

## npm Scripts

| Script | What it does |
|--------|--------------|
| `npm start` | Start Express server on `process.env.PORT || 8080` |
| `npm run seed` | Create `backend/voters.db` and seed admin account |
| `npm run bundle` | Browserify `app.js` and `login.js` into `frontend/dist/` |

---

## License

[MIT](LICENSE)
