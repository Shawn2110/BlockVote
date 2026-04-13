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
│   │   ├── Voting.sol              # Multi-election smart contract
│   │   └── Migrations.sol
│   ├── migrations/
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
│   ├── html/                       # login.html, index.html, admin.html
│   ├── css/
│   ├── js/
│   │   ├── login.js
│   │   └── app.js                  # Web3 + contract interaction
│   └── dist/                       # Bundled JS (generated, gitignored)
│
├── docs/
│   ├── architecture.md
│   └── code-explained.md
│
├── .env                            # SECRET_KEY
└── package.json
```

---

## Running the App

### Prerequisites (one-time)

```bash
npm install -g truffle ganache
npm install
```

---

### Step 1 — Start Ganache (Terminal 1)

```bash
ganache --port 8545 --networkId 1337
```

Keep this running. Copy the **10 test account private keys** printed on startup — you'll import one into MetaMask.

---

### Step 2 — Deploy the contract (Terminal 2)

```bash
cd blockchain
truffle migrate --reset
cd ..
```

---

### Step 3 — Bundle the frontend JS

```bash
npm run bundle
```

---

### Step 4 — Seed the voter database (first time only)

```bash
npm run seed
```

---

### Step 5 — Start the server

```bash
npm start
```

Open **http://localhost:8080**

---

## MetaMask Setup

> **Running in GitHub Codespaces?** Ganache is inside a container. MetaMask on your local browser can't reach `127.0.0.1:8545`. You must expose port 8545 publicly:
> ```bash
> gh codespace ports visibility 8545:public
> ```
> Then use the **HTTPS forwarding URL** (e.g. `https://xxx-8545.app.github.dev`) as the RPC URL below.

1. Install the [MetaMask](https://metamask.io/download/) browser extension
2. Add a custom network:

| Field | Value |
|-------|-------|
| Network Name | Ganache |
| RPC URL | `http://127.0.0.1:8545` *(or the Codespace HTTPS URL)* |
| Chain ID | `1337` |
| Currency Symbol | ETH |

3. Import an account using a private key from the Ganache terminal output

---

## Demo Login Accounts

| Voter ID | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `voter1` | `pass1` | Voter |
| `voter2` – `voter10` | `pass2` – `pass10` | Voter |

---

## Workflow

### Admin
1. Log in as `admin` / `admin123`
2. **Create Elections** — type a name and click "Create Election" (stored on-chain)
3. **Select an election** from the tab row
4. Add candidates (name + party) to the selected election
5. Set voting start/end dates for the selected election

### Voter
1. Log in as `voter1` / `pass1` (or any voter account)
2. MetaMask will prompt to connect — approve it
3. **Select an election** from the tab row
4. Click a candidate card to select it
5. Click **Cast Vote on Blockchain** — confirm the MetaMask transaction
6. Vote counts update after the transaction confirms

> Each Ethereum address gets one vote **per election**. Voters can participate in multiple elections.

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm start` | Start Express server on port 8080 |
| `npm run seed` | Create and populate `backend/voters.db` |
| `npm run bundle` | Browserify `app.js` and `login.js` into `frontend/dist/` |

---

## Smart Contract (`Voting.sol`)

| Function | Description |
|----------|-------------|
| `createElection(name)` | Create a new named election |
| `addCandidate(electionId, name, party)` | Add a candidate to an election |
| `setDates(electionId, start, end)` | Set voting period for an election |
| `vote(electionId, candidateId)` | Cast a vote in a specific election |
| `checkVote(electionId)` | Returns true if caller already voted in this election |
| `getElection(id)` | Returns election details (name, dates, candidate count) |
| `getCandidate(electionId, candidateId)` | Returns candidate details and vote count |
| `getCountElections()` | Total number of elections |

Enforced by the contract:
- Votes only accepted within the configured voting window
- One vote per Ethereum address **per election**
- Candidate and election IDs must exist

---

## Auth Flow

```
Login form → GET /login?voter_id=&password= (Express + SQLite)
           → JWT returned → stored in sessionStorage
           → redirected to /index.html?Authorization=Bearer <token>
           → Express middleware verifies JWT before serving the page
```

Voting is done entirely via MetaMask and the smart contract — the backend only handles login.

---

## License

[MIT](LICENSE)
