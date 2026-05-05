# BlockVote — File-by-File Code Explanation

Every file in the project, every function, what it does and why. Pair with [architecture.md](architecture.md) for the diagrams and [project-explained.md](project-explained.md) for the narrative.

---

## Contents

1. [Smart contract — `blockchain/contracts/Voting.sol`](#1-smart-contract)
2. [Truffle config — `blockchain/truffle-config.js`](#2-truffle-config)
3. [Express server — `backend/server.js`](#3-express-server)
4. [Auth route — `backend/routes/auth.js`](#4-auth-route)
5. [Admin API route — `backend/routes/admin.js`](#5-admin-api-route)
6. [Auth middleware — `backend/middleware/auth.js`](#6-auth-middleware)
7. [Database setup — `backend/db/database.js`](#7-database-setup)
8. [Database seed — `backend/db/seed.js`](#8-database-seed)
9. [Login script — `frontend/js/login.js`](#9-login-script)
10. [App script — `frontend/js/app.js`](#10-app-script)
11. [Dockerfiles](#11-dockerfiles)

---

## 1. Smart Contract

**File:** `blockchain/contracts/Voting.sol`

The on-chain source of truth. Once deployed, no one — not even the deployer — can rewrite a recorded vote. The contract owns the rules; the application is just a thin client to it.

### Structs

```solidity
struct Candidate { uint id; string name; string party; uint voteCount; }
struct Election  { uint id; string name; uint256 startDate; uint256 endDate; uint countCandidates; }
```

`startDate` / `endDate` are Unix timestamps in seconds. `countCandidates` doubles as the running count and the next-id-to-assign.

### State variables

```solidity
address public owner;
uint    public countElections;
mapping(uint => Election)                          public elections;
mapping(uint => mapping(uint => Candidate))        public candidates;
mapping(uint => mapping(address => bool))          public voters;
mapping(uint => mapping(address => bool))          public eligibleVoters;
mapping(uint => uint)                              public eligibleVoterCount;
```

- `owner` — set in the constructor to whoever deployed the contract. The single privileged address.
- `elections[id]` — election metadata.
- `candidates[electionId][candidateId]` — candidates are scoped per election.
- `voters[electionId][address]` — has this address voted in this election? One vote per address per election.
- `eligibleVoters[electionId][address]` — is this address whitelisted to vote in this election? Set by `addEligibleVoter`.
- `eligibleVoterCount[electionId]` — count of whitelisted addresses, for UI display.

### Constructor + modifier

```solidity
constructor() public { owner = msg.sender; }

modifier onlyOwner() {
    require(msg.sender == owner, "Only the contract owner");
    _;
}
```

The deployer becomes owner. Every mutating admin function carries `onlyOwner`, so even if the JWT auth was somehow bypassed, the contract still refuses calls from any other address.

### `createElection(string _name) onlyOwner returns (uint)`

Validates the name is non-empty, increments `countElections`, stores a new `Election` struct with zero dates and zero candidates. Returns the new ID.

### `setDates(uint _electionId, uint256 _start, uint256 _end) onlyOwner`

Validates election exists and `_end > _start`. Assigns the timestamps.

### `addCandidate(uint _electionId, string _name, string _party) onlyOwner returns (uint)`

Increments the election's candidate count, stores the candidate struct keyed on the new ID, returns the new ID.

### `addEligibleVoter(uint _electionId, address _voter) onlyOwner`

Validates election exists. Rejects if already eligible (avoids duplicate count increments). Sets the mapping, increments the count.

### `vote(uint _electionId, uint _candidateId)` — the only mutating function callable by non-owners

Six guards (in order):

1. Election ID is in range
2. `eligibleVoters[_electionId][msg.sender]` is true ⇒ "Not eligible to vote in this election"
3. `e.startDate > 0` ⇒ "Voting period not set"
4. `now >= e.startDate && now < e.endDate` ⇒ "Not within voting period"
5. Candidate ID is in range
6. `!voters[_electionId][msg.sender]` ⇒ "Already voted in this election"

If all pass: mark voter as voted, increment chosen candidate's count.

### View functions (free, no gas, no on-chain mutation)

- `getCountElections()` → total elections
- `getElection(id)` → `(id, name, startDate, endDate, countCandidates)`
- `getDates(electionId)` → `(startDate, endDate)`
- `getCountCandidates(electionId)` → number of candidates in this election
- `getCandidate(electionId, candidateId)` → `(id, name, party, voteCount)`
- `isEligible(electionId, address)` → bool
- `getEligibleVoterCount(electionId)` → number whitelisted
- `checkVote(electionId)` → bool, has `msg.sender` voted in this election

---

## 2. Truffle Config

**File:** `blockchain/truffle-config.js`

Defines two networks:

- **`development`** — `127.0.0.1:8545`, accepts any chain ID. Used by `truffle migrate` against local Ganache.
- **`production`** — uses `@truffle/hdwallet-provider` with `MNEMONIC` and `PRODUCTION_RPC_URL` from `.env`. Used by `truffle migrate --network production` to deploy to a remote chain (Railway-hosted Ganache).

The HDWalletProvider is wrapped in a try/import so the file works even when the package isn't installed (local-only flows don't need it).

---

## 3. Express Server

**File:** `backend/server.js`

The single Node process. Sequence on startup:

1. `dotenv.config({ path: ../.env })` — loads `SECRET_KEY` and (locally) `MNEMONIC` / `PRODUCTION_RPC_URL`.
2. `require('./db/seed')` — runs the seed module synchronously, inserting the admin row if not already present.
3. `app.use(express.json())` — parses JSON bodies for POST endpoints.
4. `app.use(authRouter)` — mounts the public `/login` route.
5. `app.use('/admin', adminRouter)` — mounts the admin API under `/admin/*`.
6. Static asset routes for `/css`, `/js`, `/dist`, `/assets`, `/favicon.ico`.
7. JWT-protected pages for `/index.html` and `/admin.html`.
8. Public root `/` serves `login.html`.
9. `app.listen(process.env.PORT || 8080)`.

The `PORT` env var is what Railway sets; locally it defaults to 8080.

---

## 4. Auth Route

**File:** `backend/routes/auth.js`

Single endpoint: `GET /login?voter_id=&password=`.

Steps:

1. Validate both query params are present (else 400).
2. `SELECT role, eth_address FROM voters WHERE voter_id = ? AND password = ?` — parameterized to prevent SQL injection.
3. If no row, 401 "Invalid Voter ID or password" (deliberately ambiguous about which field was wrong).
4. `jwt.sign({ voter_id, role, eth_address }, SECRET_KEY, { algorithm: 'HS256' })`.
5. Respond `{ token, role, eth_address }`.

The frontend uses `role` to decide where to redirect, and stores `token` plus `eth_address` in localStorage.

---

## 5. Admin API Route

**File:** `backend/routes/admin.js`

Mounted at `/admin/*`. Every request goes through `authorizeApi` then `requireAdmin`.

### `GET /admin/voters`

Returns the full voter list ordered by role descending, then voter_id ascending. Includes admin (the frontend filters it out for display).

### `POST /admin/voter`

Body: `{ voter_id, password, eth_address }`.

1. Validates all three are present.
2. Validates the address with `/^0x[a-fA-F0-9]{40}$/`.
3. `INSERT INTO voters (voter_id, password, role, eth_address) VALUES (?, ?, 'user', ?)`.
4. On `SQLITE_CONSTRAINT_PRIMARYKEY`, returns 409 "Voter ID already exists".
5. On success, returns 201 with the new voter.

### `DELETE /admin/voter/:voter_id`

Refuses to delete `admin`. Otherwise `DELETE FROM voters WHERE voter_id = ?`.

---

## 6. Auth Middleware

**File:** `backend/middleware/auth.js`

Two helpers and three exported middlewares:

- `getToken(req)` — checks `?Authorization=Bearer X` first, then the `Authorization` header.
- `verifyToken(token)` — `jwt.verify` with HS256 and `SECRET_KEY`.

### `authorizeUser` (default export, also named)

For HTML page loads. On missing token, returns a tiny HTML "Login to Continue" page — friendlier than JSON if the user navigated directly. On verify failure, returns JSON.

### `authorizeApi`

For JSON API endpoints. Always returns JSON on failure. Used by the admin router.

### `requireAdmin`

Runs *after* `authorizeApi`. Checks `req.user.role === 'admin'`, else 403.

---

## 7. Database Setup

**File:** `backend/db/database.js`

Opens (or creates) `backend/voters.db` with `better-sqlite3`. Runs `CREATE TABLE IF NOT EXISTS voters` on every load — idempotent.

Schema:

```sql
CREATE TABLE voters (
    voter_id    TEXT PRIMARY KEY,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    eth_address TEXT
);
```

- `voter_id` is the natural primary key.
- `role` is constrained to `'admin'` or `'user'` at the SQL level.
- `eth_address` is nullable in the schema but required by the API for new voters.

Exports the `db` instance — Node's require cache means every importer shares the same connection.

---

## 8. Database Seed

**File:** `backend/db/seed.js`

Run on every server startup (called from `server.js`). Inserts only the admin row, bound to the deterministic Ganache deployer address `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1`. Uses `INSERT OR IGNORE` so it's safe to run multiple times.

All other voters are added at runtime via the admin UI.

---

## 9. Login Script

**File:** `frontend/js/login.js`

Vanilla JS, runs as a Browserified bundle on `login.html`.

On form submit:

1. `preventDefault()` — stop the browser's default POST navigation.
2. Trim both inputs, show error if either is empty.
3. Hide button text, show spinner.
4. `fetch('/login?voter_id=...&password=...')`.
5. On non-OK response: re-show button, set error text.
6. On success: store the bound address (`localStorage.setItem('bvBoundAddress', data.eth_address)`), store the JWT under `jwtTokenAdmin` or `jwtTokenVoter` based on role, redirect to the appropriate page with `?Authorization=Bearer <token>` in the URL.

---

## 10. App Script

**File:** `frontend/js/app.js`

The biggest file. Browserified bundle that powers both `index.html` (voter) and `admin.html` (admin). Detects which page it's on via `document.title.includes('Admin')`.

### Module-level state

```js
window.App = {
  instance: null,           // the connected Voting contract
  selectedElectionId: null, // active tab
  account: null,            // current MetaMask address
  boundAddress: null,       // address registered for this login
  voters: []                // admin: cached list of voters
};
```

### `App.eventStart()` — entry, async

1. Confirms `window.ethereum` exists (MetaMask installed).
2. Requests account access (triggers MetaMask popup).
3. Wires up Web3 + the contract abstraction.
4. Reads `App.boundAddress` from localStorage.
5. Tries `VotingContract.deployed()`. On failure, falls back to `.at(latestKnownAddress)` from the build artifacts — handles network-id mismatches.
6. **Address-binding gate**: if `boundAddress` is set and doesn't match `App.account`, renders an error and stops. No further contract calls are made.
7. Branches to `initAdmin()` or `initVoter()`.

### `App.initAdmin()`

- `App.loadVoters()` — fetches and renders the voter registry list.
- `App.loadElectionTabs('admin')` — renders the election tabs.
- Wires up the four admin buttons:
  - `#registerVoterBtn` → `App.registerVoter()`
  - `#createElectionBtn` → `instance.createElection(name)` then refresh tabs
  - `#addCandidate` → `instance.addCandidate(eId, name, party)` then refresh candidates
  - `#addDate` → `instance.setDates(eId, start, end)`

### `App.adminToken()`

Returns `localStorage.getItem('jwtTokenAdmin')`. Used as the `Authorization` header on all admin API calls.

### `App.loadVoters()`

`fetch('/admin/voters', { headers: { Authorization: 'Bearer ' + token } })` → caches in `App.voters` → calls `App.renderVoters()` → if an election is selected, also re-runs `App.loadEligibility()` so eligibility status reflects the new voter list.

### `App.renderVoters()`

Filters out the admin row, renders each remaining voter as an `.admin-candidate-row` with avatar, voter_id, truncated address, and a `[ remove ]` button that calls `App.deleteVoter(id)`.

### `App.registerVoter()`

Reads the three input fields. Validates all present, validates address format. POSTs to `/admin/voter`. On success: clear inputs, show green status message, refresh voter list.

### `App.deleteVoter(voter_id)`

`confirm()` first, then `DELETE /admin/voter/:id`, then refresh.

### `App.initVoter()`

Just `App.loadElectionTabs('voter')`.

### `App.loadElectionTabs(mode)`

Reads `getCountElections()` then fans out parallel `getElection(i)` calls.

For voter mode: also calls `isEligible(electionId, App.account)` for each election in parallel; renders only those returning true. If none, shows an empty state telling the voter they're not yet whitelisted anywhere.

For admin mode: renders all elections.

Auto-selects the first visible election by calling `App.selectElection(id, mode)`.

### `App._renderElectionTabs(elections, mode)`

Internal helper. Builds the `<button class="election-tab">` strip and inserts it into `#electionTabs` (admin) or `#electionTabsWrapper` (voter).

### `App.selectElection(electionId, mode)`

Marks the active tab. Reads the election from chain. For admin: sets the "Managing: name" header, shows the management panel, loads candidates and eligibility. For voter: sets the title, formats the date range, shows the voter view, loads candidates, runs `checkVote(electionId)` to detect repeat-vote attempts and lock the button.

### `App.loadEligibility(electionId)` — admin only

For each non-admin voter with an `eth_address`, fan out `isEligible(electionId, address)` calls in parallel. Render rows showing either an `eligible` pill or a `[ whitelist ]` button calling `App.makeEligible(...)`.

### `App.makeEligible(electionId, address, btn)` — admin only

Disables the button, calls `instance.addEligibleVoter(electionId, address)`. On confirm, refreshes the eligibility list. On error, shows it and re-enables the button.

### `App.loadCandidates(instance, electionId)`

Reads `getCountCandidates(electionId)`, fans out `getCandidate(electionId, i)` calls in parallel. For admin: renders compact rows with vote counts. For voter: renders interactive cards (`onclick="App.selectCandidate(...)"`).

### `App.selectCandidate(el, id)`

Marks the clicked card as selected, checks the underlying radio input, enables the vote button.

### `App.vote()`

Validates an election and a candidate are selected. Disables the button, shows "Waiting for blockchain confirmation". Calls `instance.vote(electionId, candidateId)`. On confirm: green message, page reloads in 2s. On revert: shows the contract's revert reason (e.g. "Not within voting period").

### Bottom of file

```js
window.addEventListener('load', function () {
  window.eth = new Web3(window.ethereum || new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
  window.App.eventStart();
});
```

Sets up a Web3 instance (preferring MetaMask, falling back to direct HTTP for read-only) and kicks off the app.

---

## 11. Dockerfiles

### `Dockerfile` — the Node + frontend service

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run bundle
ENV PORT=8080
EXPOSE 8080
CMD ["node", "backend/server.js"]
```

- `git` is required because some npm deps reference git URLs.
- `python3 make g++` are required to compile native modules (e.g. `better-sqlite3`) when no prebuilt binary matches.
- `--omit=dev` excludes dev-only deps (e.g. `@truffle/hdwallet-provider`).
- The bundle step at build time means the contract address from `blockchain/build/contracts/Voting.json` (which is committed to the repo) gets baked into the JS bundle — no runtime config injection needed.

### `Dockerfile.ganache` — the chain service

```dockerfile
FROM node:20-slim
RUN npm install -g ganache@7.9.2
RUN mkdir -p /data
EXPOSE 8545
CMD ["sh", "-c", "ganache --host 0.0.0.0 --port ${PORT:-8545} --chain.networkId 1337 --chain.chainId 1337 --deterministic --db /data/chain"]
```

- `node:20-slim` (debian-based) chosen over alpine because the µWS binary in Ganache prefers glibc.
- `--chain.networkId` and `--chain.chainId` use the dotted-form keys (Ganache 7.x rejects `--chainId` directly).
- `--deterministic` gives the same 10 accounts every restart.
- `--db /data/chain` persists chain state — this is the path Railway mounts a volume to, so blocks survive restarts and redeploys.
- Binds to `0.0.0.0` so it's reachable on Railway's network, on the port Railway assigns via `$PORT`.
