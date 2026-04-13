# BlockVote — Decentralized Voting System

A secure and transparent voting system built on the Ethereum blockchain. Votes are recorded immutably on-chain via a Solidity smart contract, while a lightweight Node.js + SQLite backend handles authentication.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Solidity ^0.5.15 |
| Blockchain | Ethereum (Ganache local) |
| Frontend | HTML5, CSS3, Vanilla JS, jQuery |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JSON Web Tokens (JWT) |
| Wallet | MetaMask |
| Build | Truffle, Browserify |

---

## Project Structure

```
BlockVote/
├── blockchain/
│   ├── contracts/
│   │   ├── Voting.sol              # Main voting smart contract
│   │   └── Migrations.sol
│   ├── migrations/
│   │   ├── 1_initial_migration.js
│   │   └── 2_deploy_contracts.js
│   └── truffle-config.js
│
├── backend/
│   ├── server.js                   # Express server (port 8080)
│   ├── db/
│   │   ├── database.js             # SQLite schema
│   │   └── seed.js                 # Populates voter accounts
│   ├── routes/auth.js              # GET /login
│   └── middleware/auth.js          # JWT check
│
├── frontend/
│   ├── html/                       # login, voter, admin pages
│   ├── css/
│   ├── js/
│   │   ├── login.js
│   │   └── app.js                  # Web3 + contract interaction
│   ├── assets/
│   └── dist/                       # Bundled JS (generated)
│
├── .env                            # SECRET_KEY
└── package.json
```

---

## Local Setup

### 1. Install global tools

```bash
npm install -g truffle ganache
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the JWT secret

Edit `.env` in the project root:

```
SECRET_KEY=any_string_you_want
```

### 4. Set up MetaMask

Install the [MetaMask](https://metamask.io/download/) browser extension, then add a custom network:

| Field | Value |
|-------|-------|
| Network Name | Ganache |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `1337` |
| Currency | ETH |

---

## Running the App

### Terminal 1 — Start the blockchain

```bash
ganache --port 8545 --networkId 1337
```

Keep this running. It prints 10 funded test accounts with private keys.

### Terminal 2 — Deploy contracts, bundle, and start

```bash
cd blockchain
truffle compile
truffle migrate --network development
cd ..

npm run bundle
npm run seed       # first time only — creates voters.db
npm start
```

Open **http://localhost:8080**.

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm start` | Start Express server on port 8080 |
| `npm run seed` | Create and populate `backend/voters.db` |
| `npm run bundle` | Browserify `app.js` and `login.js` into `frontend/dist/` |

---

## Demo Accounts

| Voter ID | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `voter1` | `pass1` | Voter |
| `voter2` – `voter10` | `pass2` – `pass10` | Voter |

---

## Workflow

1. **Admin** — Log in as `admin`, add candidates, set the voting start and end dates
2. **Voters** — Log in as `voter1`–`voter10`, select a candidate, click **Cast Vote**
3. MetaMask will prompt you to confirm the blockchain transaction
4. Vote counts update live on the voter and admin pages

---

## How the Auth Flow Works

```
Login form → POST /login (Express + SQLite)
           → JWT returned → stored in localStorage
           → redirected to /index.html?Authorization=Bearer <token>
           → Express middleware verifies JWT before serving the page
```

Voting and results are read/written directly to the smart contract via MetaMask — the backend is only involved in authentication.

---

## Smart Contract (`Voting.sol`)

| Function | Description |
|----------|-------------|
| `addCandidate(name, party)` | Register a new candidate |
| `setDates(start, end)` | Set the voting period (one-time) |
| `vote(candidateID)` | Cast a vote |
| `checkVote()` | Returns true if the caller has already voted |
| `getCandidate(id)` | Returns candidate details and vote count |
| `getDates()` | Returns voting start/end timestamps |

Enforced by the contract:
- Votes only accepted within the voting window
- One vote per Ethereum address
- Candidate ID must exist

---

## License

[MIT](LICENSE)
