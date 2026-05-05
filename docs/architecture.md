# BlockVote — Architecture & Flows

Reference diagrams for the running system. For the *narrative* explanation see [project-explained.md](project-explained.md); for the *file-by-file* explanation see [code-explained.md](code-explained.md).

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                              │
│                                                                            │
│   ┌─────────────┐      ┌──────────────────┐      ┌──────────────────┐      │
│   │  login.html │      │   index.html     │      │   admin.html     │      │
│   │  login.js   │      │   app.bundle.js  │      │   app.bundle.js  │      │
│   └──────┬──────┘      └────────┬─────────┘      └────────┬─────────┘      │
│          │                      │                          │               │
│          │ fetch /login         │ Web3 + MetaMask          │ Web3 + fetch  │
└──────────┼──────────────────────┼──────────────────────────┼───────────────┘
           │                      │                          │
           ▼                      ▼                          ▼
┌──────────────────────┐    ┌────────────────────────────────────────────┐
│  EXPRESS SERVER      │    │              MetaMask Wallet               │
│  backend/server.js   │    │   Signs & broadcasts Ethereum transactions │
│  port 8080 / $PORT   │    └──────────────────────┬─────────────────────┘
│                      │                           │
│  Routes:             │                           │ JSON-RPC
│  GET /               │                           ▼
│  GET /login ─────────┤───►  ┌─────────────────────────────────────────┐
│  GET /index.html     │      │   GANACHE EVM  (local or Railway)       │
│  GET /admin.html     │      │   chain ID 1337                         │
│  GET /css /js /dist  │      │                                         │
│                      │      │   ┌───────────────────────────────────┐ │
│  Admin API:          │      │   │       Voting.sol Contract         │ │
│  GET    /admin/      │      │   │                                   │ │
│         voters       │      │   │  owner (set in constructor)       │ │
│  POST   /admin/      │      │   │                                   │ │
│         voter        │      │   │  createElection(name)        [+]  │ │
│  DELETE /admin/      │      │   │  addCandidate(eId,name,prty) [+]  │ │
│         voter/:id    │      │   │  setDates(eId,start,end)     [+]  │ │
└──────────┬───────────┘      │   │  addEligibleVoter(eId,addr)  [+]  │ │
           │                  │   │                                   │ │
           ▼                  │   │  vote(eId, candId)                │ │
┌──────────────────────┐      │   │  checkVote(eId)                   │ │
│  SQLITE DATABASE     │      │   │  isEligible(eId, addr)            │ │
│  backend/voters.db   │      │   │  getElection(id)                  │ │
│                      │      │   │  getCandidate(eId, cId)           │ │
│  Table: voters       │      │   │  getCountElections()              │ │
│  ┌────────────────┐  │      │   │  getCountCandidates(eId)          │ │
│  │ voter_id  PK   │  │      │   │  getEligibleVoterCount(eId)       │ │
│  │ password       │  │      │   │                                   │ │
│  │ role           │  │      │   │  [+] = onlyOwner                  │ │
│  │ eth_address    │  │      │   └───────────────────────────────────┘ │
│  └────────────────┘  │      └─────────────────────────────────────────┘
└──────────────────────┘
```

---

## Authentication Flow

```
User submits voter_id + password
           │
           ▼
   login.js → GET /login?voter_id=&password=
           │
           ▼
  ┌─────────────────────────────────┐
  │  routes/auth.js                 │
  │  SELECT role, eth_address       │
  │  FROM voters                    │
  │  WHERE voter_id=? AND password=?│
  └────────────┬────────────────────┘
               │
        ┌──────┴──────┐
        │             │
     Found?        Not found
        │             │
        ▼             ▼
   Sign JWT      401 "Invalid Voter ID
   {voter_id,         or password"
    role,
    eth_address}
        │
        ▼
   Return { token, role, eth_address }
        │
        ▼
   login.js stores in localStorage:
     • jwtTokenAdmin / jwtTokenVoter (the JWT)
     • bvBoundAddress (the registered eth address)
        │
        ├── role=admin ──► /admin.html?Authorization=Bearer <token>
        │
        └── role=user  ──► /index.html?Authorization=Bearer <token>
```

---

## Page Access (JWT Middleware)

```
Browser requests /index.html or /admin.html
           │
           ▼
  middleware/auth.js  →  authorizeUser
  Reads token from query string
  ?Authorization=Bearer <token>
           │
        ┌──┴──┐
        │     │
     Valid?  No / invalid
        │     │
        ▼     ▼
  req.user  401 HTML
  =payload  "Login to Continue"
        │
        ▼
   res.sendFile(...)
```

For the admin API endpoints (`/admin/*`), `authorizeApi + requireAdmin` is used instead — token can be passed via Authorization header, and a 403 is returned if `role !== 'admin'`.

---

## MetaMask Address Binding (Frontend Gate)

After the JWT-protected page loads, before the contract is even read:

```
app.js: eventStart()
   │
   ▼
   await ethereum.request({ method: 'eth_requestAccounts' })
   App.account = accounts[0]
   App.boundAddress = localStorage.getItem('bvBoundAddress')
   │
   ▼
   App.boundAddress.toLowerCase() === App.account.toLowerCase()  ?
   │
   ┌─────────────┴─────────────┐
   │                           │
  YES                         NO
   │                           │
   ▼                           ▼
   continue to                 render error in red:
   initAdmin / initVoter       "Connect MetaMask account
                                0x... (registered for this login)"
                               and STOP — no contract calls made.
```

This closes the loophole where a voter could swap MetaMask accounts mid-session to vote multiple times under one BlockVote login.

---

## Voter Registry Flow (Admin)

```
Admin opens admin.html
   │
   ▼
   App.loadVoters() ── GET /admin/voters (Bearer JWT)
   │                   │
   │                   ▼
   │                   db.prepare('SELECT voter_id, eth_address, role FROM voters
   │                              ORDER BY role DESC, voter_id ASC').all()
   │                   │
   │                   ▼
   │                   res.json(voters)
   │
   ▼
   Renders the "Registered Voters" list
   (admin row excluded from display via filter)


Admin fills the Voter Registry form and clicks Register Voter
   │
   ▼
   App.registerVoter()
   │
   ▼
   POST /admin/voter   (Bearer JWT)
   { voter_id, password, eth_address }
   │
   ▼
   server validates address format /^0x[a-fA-F0-9]{40}$/
   │
   ▼
   INSERT INTO voters VALUES (?, ?, 'user', ?)
   │
   ▼
   201 { voter_id, eth_address, role }
   │
   ▼
   App.loadVoters() refreshes the list
```

No on-chain transaction is made for voter registration — that happens later via `addEligibleVoter` per election.

---

## Eligibility Whitelisting Flow (Admin)

```
Admin selects an election tab
   │
   ▼
   App.selectElection(electionId, 'admin')
   │
   ▼
   App.loadEligibility(electionId)
   │
   ▼
   For each registered voter v with v.eth_address:
     instance.isEligible(electionId, v.eth_address)  (parallel)
   │
   ▼
   Promise.all → render rows:
     • eligible voter  → status pill "eligible"
     • not eligible    → button [ whitelist ]


Admin clicks [ whitelist ] for a voter
   │
   ▼
   App.makeEligible(electionId, address)
   │
   ▼
   instance.addEligibleVoter(electionId, address)   ← onlyOwner tx
   │
   ▼
   MetaMask popup: confirm
   │
   ▼
   contract:
     require(_electionId valid)
     require(!eligibleVoters[_electionId][_voter])
     eligibleVoters[_electionId][_voter] = true
     eligibleVoterCount[_electionId]++
   │
   ▼
   App.loadEligibility(electionId) refreshes — pill flips to "eligible"
```

---

## Voting Flow (Voter)

```
Voter logs in, page loads
   │
   ▼
   App.eventStart() → address-binding check (above)
   │
   ▼
   App.loadElectionTabs('voter')
   │
   ▼
   getCountElections() → N
   for i in 1..N: getElection(i)              (parallel)
   │
   ▼
   For each election: isEligible(electionId, App.account)  (parallel)
   │
   ▼
   Render only elections where isEligible === true
   │
   ▼
   Auto-select first eligible election → App.selectElection(id, 'voter')
   │
   ▼
   App.loadCandidates(instance, electionId)
   App.instance.checkVote(electionId)  →  if true, disable button + show
                                          "You have already cast your vote"


Voter selects a candidate, clicks Cast Vote on Blockchain
   │
   ▼
   App.vote()
   │
   ▼
   instance.vote(electionId, candidateId)   ← signed by voter's MetaMask
   │
   ▼
   Contract checks (in order):
     1. _electionId > 0 && <= countElections        | "Invalid election"
     2. eligibleVoters[_electionId][msg.sender]      | "Not eligible to vote in this election"
     3. e.startDate > 0                              | "Voting period not set"
     4. now in [startDate, endDate)                  | "Not within voting period"
     5. _candidateId valid for this election         | "Invalid candidate"
     6. !voters[_electionId][msg.sender]             | "Already voted in this election"
   │
   ▼
   All pass:
     voters[_electionId][msg.sender] = true
     candidates[_electionId][_candidateId].voteCount++
   │
   ▼
   "Vote cast successfully!"  →  page reloads in 2s
```

---

## Layer Map

```
┌──────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (frontend/html/, frontend/css/)              │
│  login.html · index.html · admin.html                            │
│  login.css  · index.css  · admin.css                             │
│  Terminal aesthetic, light/dark theme toggle                     │
├──────────────────────────────────────────────────────────────────┤
│  CLIENT LOGIC LAYER (frontend/js/)                               │
│  login.js  — submit, fetch /login, store JWT + boundAddress       │
│  app.js    — Web3 init, MetaMask, voter registry, eligibility,    │
│              candidate render, vote, address-binding gate         │
├──────────────────────────────────────────────────────────────────┤
│  SERVER LAYER (backend/)                                         │
│  server.js          — Express, mounts routers, static, PORT env  │
│  routes/auth.js     — POST /login                                │
│  routes/admin.js    — GET/POST/DELETE /admin/voter*              │
│  middleware/auth.js — authorizeUser, authorizeApi, requireAdmin  │
├──────────────────────────────────────────────────────────────────┤
│  DATA LAYER (backend/db/)                                        │
│  database.js — SQLite schema (voters: voter_id PK, password,     │
│                role, eth_address)                                │
│  seed.js     — admin only (deployer's eth_address)               │
│  voters.db   — SQLite file (gitignored)                          │
├──────────────────────────────────────────────────────────────────┤
│  BLOCKCHAIN LAYER (blockchain/)                                  │
│  contracts/Voting.sol      — eligibility, onlyOwner, six guards  │
│  migrations/               — Truffle deploy scripts              │
│  truffle-config.js         — development + production networks   │
│  build/contracts/          — compiled ABI + deployed addresses   │
│                              (committed so Docker can bundle)    │
├──────────────────────────────────────────────────────────────────┤
│  DEPLOYMENT LAYER (root)                                         │
│  Dockerfile         — Node + Express + frontend bundle service   │
│  Dockerfile.ganache — Ganache w/ --deterministic --db /data/chain│
└──────────────────────────────────────────────────────────────────┘
```

---

## Production Topology (Railway)

```
                       ┌─────────────────────────────────┐
                       │       voter's browser           │
                       │  ┌───────────┐                  │
                       │  │ MetaMask  │                  │
                       │  │ chain     │                  │
                       │  │ 1337      │                  │
                       │  └─────┬─────┘                  │
                       └────────┼────────────────────────┘
                                │
            HTTPS (login page,  │  HTTPS (signed JSON-RPC for vote tx)
            JWT API calls)      │
                                │
            ┌───────────────────┼───────────────────┐
            ▼                                       ▼
   ┌──────────────────────┐               ┌──────────────────────┐
   │  blockvote-app       │               │  blockvote-chain     │
   │  Railway service     │               │  Railway service     │
   │  Dockerfile          │               │  Dockerfile.ganache  │
   │  Node 20 alpine      │               │  Node 20 slim        │
   │  Express :PORT       │               │  Ganache 7.9.2 :PORT │
   │                      │               │  --deterministic     │
   │  Env: SECRET_KEY     │               │  --db /data/chain    │
   │                      │               │  Volume: /data 1GB   │
   └──────────────────────┘               └──────────────────────┘
            ▲                                       ▲
            │ git push origin main                  │ git push origin main
            └────── Railway auto-rebuild ───────────┘
                          on commit
```

The two services live in the same Railway project, both pointed at the same GitHub repo, but each builds from a different Dockerfile. The chain service has a persistent volume so its blockchain state isn't wiped on every redeploy.
