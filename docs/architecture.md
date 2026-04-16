# BlockVote — Architecture Flow Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (Client)                             │
│                                                                         │
│   ┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐    │
│   │  login.html │      │   index.html     │      │   admin.html    │    │
│   │  login.js   │      │   app.bundle.js  │      │  app.bundle.js  │    │
│   └──────┬──────┘      └────────┬─────────┘      └────────┬────────┘    │
│          │                      │                          │            │
│          │ fetch /login         │ Web3 + MetaMask          │            │
└──────────┼──────────────────────┼──────────────────────────┼────────────┘
           │                      │                          │
           ▼                      ▼                          ▼
┌──────────────────────┐   ┌───────────────────────────────────────────┐
│   EXPRESS SERVER     │   │              MetaMask Wallet              │
│   backend/server.js  │   │   Signs & broadcasts Ethereum transactions│
│   :8080              │   └──────────────────────┬────────────────────┘
│                      │                          │
│  Routes:             │                          │ JSON-RPC
│  GET /               │                          ▼
│  GET /login ─────────┤─────►  ┌────────────────────────────────────┐
│  GET /index.html     │        │        GANACHE (Local Chain)       │
│  GET /admin.html     │        │        http://127.0.0.1:8545       │
│  GET /css/*          │        │        Network ID: 1337            │
│  GET /js/*           │        │                                    │
│  GET /dist/*         │        │   ┌─────────────────────────────┐  │
│                      │        │   │     Voting.sol Contract     │  │
└──────────┬───────────┘        │   │                             │  │
           │                    │   │  createElection()           │  │
           │                    │   │  addCandidate(electionId)   │  │
           ▼                    │   │  setDates(electionId)       │  │
┌──────────────────────┐        │   │  vote(electionId, candId)   │  │
│  SQLITE DATABASE     │        │   │  checkVote(electionId)      │  │
│  backend/voters.db   │        │   │  getElection(id)            │  │
│                      │        │   │  getCandidate(eId, cId)     │  │
│  Table: voters       │        │   │  getCountElections()        │  │
│  ┌──────────────┐    │        │   └─────────────────────────────┘  │
│  │ voter_id     │    │        └────────────────────────────────────┘
│  │ password     │    │
│  │ role         │    │
│  └──────────────┘    │
└──────────────────────┘
```

---

## Authentication Flow

```
User enters Voter ID + Password
           │
           ▼
    login.js sends
  GET /login?voter_id=&password=
           │
           ▼
  ┌─────────────────────┐
  │  routes/auth.js     │
  │  Queries SQLite:    │
  │  SELECT role FROM   │
  │  voters WHERE       │
  │  voter_id=? AND     │
  │  password=?         │
  └────────┬────────────┘
           │
     ┌─────┴──────┐
     │            │
  Found?       Not found
     │            │
     ▼            ▼
  Sign JWT     401 Error
  {voter_id,   "Invalid ID
   role}        or password"
     │
     ▼
  Return {token, role}
     │
     ▼
  login.js stores token
  in sessionStorage
     │
     ├── role=admin ──► /admin.html?Authorization=Bearer <token>
     │
     └── role=user  ──► /index.html?Authorization=Bearer <token>
```

---

## Page Access Flow (JWT Middleware)

```
Browser requests /index.html or /admin.html
           │
           ▼
  middleware/auth.js
  Extract token from
  ?Authorization=Bearer <token>
           │
     ┌─────┴──────┐
     │            │
  Token OK?    No token / invalid
     │            │
     ▼            ▼
  req.user =   401 "Login to
  decoded      Continue"
  payload
     │
     ▼
  Serve HTML page
```

---

## Multi-Election Flow (On-Chain)

```
Admin creates elections
  createElection("Council Vote") ──► elections[1] = {id:1, name, 0, 0, 0}
  createElection("Board Vote")   ──► elections[2] = {id:2, name, 0, 0, 0}
           │
           ▼
Admin selects election tab (e.g. Election 1)
           │
           ├── addCandidate(1, "Alice", "Green Party")
           │       ──► candidates[1][1] = {id:1, "Alice", ...}
           │
           ├── addCandidate(1, "Bob", "Blue Party")
           │       ──► candidates[1][2] = {id:2, "Bob", ...}
           │
           └── setDates(1, startTimestamp, endTimestamp)
                   ──► elections[1].startDate = start
                   ──► elections[1].endDate   = end
           │
           ▼
Voter logs in → sees election tab row
           │
           ├── Selects "Council Vote" tab
           │       ──► getElection(1) → name, dates
           │       ──► getCandidate(1, 1..N) → candidate cards rendered
           │
           ├── Clicks a candidate card
           │       ──► App.selectCandidate() marks card as selected
           │       ──► vote button enabled
           │
           └── Clicks "Cast Vote on Blockchain"
                   ──► App.vote() → instance.vote(electionId=1, candidateId=2)
                   ──► MetaMask popup: confirm transaction
                   ──► Ganache executes vote() on Voting.sol
```

---

## Voting (Contract) Flow

```
instance.vote(electionId, candidateId) called
           │
           ▼
  Contract checks:
  1. electionId valid                ──► fail: revert "Invalid election"
  2. election.startDate > 0          ──► fail: revert "Voting period not set"
  3. now >= startDate && now < end   ──► fail: revert "Not within voting period"
  4. candidateId valid               ──► fail: revert "Invalid candidate"
  5. !voters[electionId][msg.sender] ──► fail: revert "Already voted"
           │
     All checks pass
           │
           ▼
  voters[electionId][msg.sender] = true
  candidates[electionId][candidateId].voteCount++
  (permanent, immutable on-chain)
           │
           ▼
  "Vote cast successfully!"
  Page reloads after 2s
```

---

## Admin Flow (On-Chain)

```
Admin logs in → /admin.html
       │
       ├── Create Election ──► createElection(name)
       │                       ──► Ganache: countElections++
       │                       ──► elections[id] = {id, name, 0, 0, 0}
       │                       ──► Tab strip reloads with new election
       │
       ├── Select Election Tab ──► App.selectElection(id, 'admin')
       │                           ──► getElection(id) → show "Managing: X"
       │                           ──► loadCandidates(id)
       │
       ├── Add Candidate ──► addCandidate(electionId, name, party)
       │                     ──► candidates[electionId][newId] = {...}
       │                     ──► candidate list refreshes
       │
       └── Set Voting Dates ──► setDates(electionId, start, end)
                               ──► elections[electionId].startDate = start
                               ──► elections[electionId].endDate   = end
```

---

## Complete Layer Map

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (frontend/)                          │
│  login.html · index.html · admin.html                    │
│  login.css  · index.css  · admin.css                     │
├──────────────────────────────────────────────────────────┤
│  CLIENT LOGIC LAYER (frontend/js/)                       │
│  login.js  — form submit, fetch /login, redirect         │
│  app.js    — Web3 init, multi-election contract calls    │
│              App.loadElectionTabs()                      │
│              App.selectElection()                        │
│              App.loadCandidates()                        │
│              App.vote()                                  │
├──────────────────────────────────────────────────────────┤
│  SERVER LAYER (backend/)                                 │
│  server.js          — Express routes + static files      │
│  routes/auth.js     — /login endpoint                    │
│  middleware/auth.js — JWT verification                   │
├──────────────────────────────────────────────────────────┤
│  DATA LAYER (backend/db/)                                │
│  database.js — SQLite connection + schema                │
│  seed.js     — voter account population                  │
│  voters.db   — SQLite file (git-ignored)                 │
├──────────────────────────────────────────────────────────┤
│  BLOCKCHAIN LAYER (blockchain/)                          │
│  contracts/Voting.sol      — multi-election voting logic │
│  migrations/               — Truffle deploy scripts      │
│  truffle-config.js         — Ganache network config      │
│  build/contracts/          — compiled ABI + address      │
└──────────────────────────────────────────────────────────┘
```
