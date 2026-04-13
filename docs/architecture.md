# BlockVote — Architecture Flow Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (Client)                             │
│                                                                         │
│   ┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐  │
│   │  login.html │      │   index.html     │      │   admin.html    │  │
│   │  login.js   │      │   app.bundle.js  │      │  app.bundle.js  │  │
│   └──────┬──────┘      └────────┬─────────┘      └────────┬────────┘  │
│          │                      │                          │            │
│          │ fetch /login         │ Web3 + MetaMask          │            │
└──────────┼──────────────────────┼──────────────────────────┼────────────┘
           │                      │                          │
           ▼                      ▼                          ▼
┌──────────────────────┐   ┌───────────────────────────────────────────┐
│   EXPRESS SERVER     │   │              MetaMask Wallet               │
│   backend/server.js  │   │   Signs & broadcasts Ethereum transactions │
│   :8080              │   └──────────────────────┬────────────────────┘
│                      │                          │
│  Routes:             │                          │ JSON-RPC
│  GET /               │                          ▼
│  GET /login ─────────┤─────►  ┌────────────────────────────────────┐
│  GET /index.html     │        │        GANACHE (Local Chain)        │
│  GET /admin.html     │        │        http://127.0.0.1:8545        │
│  GET /css/*          │        │        Network ID: 1337             │
│  GET /js/*           │        │                                     │
│  GET /dist/*         │        │   ┌─────────────────────────────┐  │
│  GET /assets/*       │        │   │     Voting.sol Contract     │  │
└──────────┬───────────┘        │   │                             │  │
           │                    │   │  addCandidate()             │  │
           │                    │   │  vote()                     │  │
           ▼                    │   │  checkVote()                │  │
┌──────────────────────┐        │   │  setDates()                 │  │
│  SQLITE DATABASE     │        │   │  getCandidate()             │  │
│  backend/voters.db   │        │   │  getCountCandidates()       │  │
│                      │        │   │  getDates()                 │  │
│  Table: voters       │        │   └─────────────────────────────┘  │
│  ┌──────────────┐    │        └────────────────────────────────────┘
│  │ voter_id     │    │
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
  in localStorage
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

## Voting Flow (On-Chain)

```
Voter selects a candidate card
           │
           ▼
    App.vote() called
           │
           ▼
  VotingContract.deployed()
  .then instance.vote(candidateID)
           │
           ▼
  MetaMask popup:
  "Confirm Transaction?"
           │
     ┌─────┴──────┐
     │            │
  Confirmed    Rejected
     │            │
     ▼            ▼
  Ganache       Error shown
  executes      to user
  Voting.sol
  vote()
     │
     ▼
  Contract checks:
  1. votingStart <= now < votingEnd  ──► fail: revert
  2. candidateID valid               ──► fail: revert
  3. !voters[msg.sender]             ──► fail: revert (double vote)
     │
     ▼
  voters[msg.sender] = true
  candidates[id].voteCount++
  (stored permanently on-chain)
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
       ├── Add Candidate ──► addCandidate(name, party)
       │                     ──► Ganache: countCandidates++
       │                     ──► candidates[id] = {id, name, party, 0}
       │
       ├── Set Voting Dates ──► setDates(startTimestamp, endTimestamp)
       │                        ──► Ganache: validates one-time-only
       │                        ──► votingStart = start, votingEnd = end
       │
       └── Live Results ──► loadCandidates()
                            ──► getCountCandidates() → N
                            ──► getCandidate(1..N) in parallel
                            ──► render vote count rows
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
│  app.js    — Web3 init, contract calls, DOM updates      │
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
│  contracts/Voting.sol      — voting logic on-chain       │
│  migrations/               — Truffle deploy scripts      │
│  truffle-config.js         — Ganache network config      │
│  build/contracts/          — compiled ABI + address      │
└──────────────────────────────────────────────────────────┘
```
