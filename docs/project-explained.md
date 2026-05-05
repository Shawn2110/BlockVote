# BlockVote — Project Explained

This document is the long-form companion to the README. It walks through what BlockVote is, why it's structured the way it is, and how every moving part fits together. Read this end-to-end and you should be able to defend any architectural decision in a viva or report.

---

## 1. What problem does BlockVote solve?

Conventional electronic voting systems are centralized: a single server records votes, and a single party (the operator) is trusted to report the tally honestly. The same party can also alter records after the fact, since the database is mutable. Even with audit trails, the operator can rewrite the audit trail itself.

BlockVote sidesteps this by recording every vote as a state change on an Ethereum smart contract. Once a transaction is mined, the vote is part of the chain's history — independently verifiable by anyone, immutable without rewriting every block since. The operator of the application can no longer silently change the outcome.

Our threat model:

- **Untrusted operator** — the person running the BlockVote server cannot rewrite votes
- **Untrusted users** — voters cannot vote twice, vote outside the voting window, or vote in elections they're not eligible for
- **Untrusted network** — interception of HTTP traffic does not let an attacker forge votes (votes are signed client-side by the voter's private key)

What we do *not* defend against:

- A malicious admin can still create or remove elections, candidates, and eligibility lists. The contract trusts whoever deploys it.
- Voter coercion / receipt-freeness. Anyone watching the voter sign in MetaMask can see what they voted for.
- Compromised MetaMask wallet — if an attacker steals your private key, they can vote as you.

---

## 2. Architecture at a glance

There are three independent layers, each with a single responsibility:

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │ login.html   │   │ index.html   │   │ admin.html   │     │
│  │ (auth UI)    │   │ (vote UI)    │   │ (manage UI)  │     │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘     │
│         │                  │                  │             │
│         │ /login           │ Web3 + MetaMask  │             │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  └──────────────────┴────► MetaMask
  ┌──────────────────┐                                  │
  │ Express + SQLite │                                  │ JSON-RPC
  │  POST /login     │                                  ▼
  │  /admin/voter    │                          ┌────────────────┐
  │  JWT issuance    │                          │  Ganache (EVM) │
  └──────────────────┘                          │  Voting.sol    │
                                                └────────────────┘
   "Who are you?"                              "What can you do?"
```

- **Express + SQLite** answers *who are you?* It stores `voter_id`, hashed-ish-but-honestly-plaintext password, role, and the bound Ethereum address. On successful login it issues a JWT carrying these claims.
- **MetaMask** holds the voter's private key and signs transactions. It is the user's identity *on-chain*.
- **Voting.sol on Ganache** answers *what can you do?* It refuses any call that doesn't match its requirements: only the contract owner can mutate elections; only whitelisted addresses can vote; addresses can only vote once per election within the configured window.

The off-chain layer is a convenience for human-friendly identity. The on-chain layer is the source of truth for any decision that affects the outcome.

---

## 3. The voter binding

The single most important security property — and the one most often missed in similar projects — is the binding between a voter's BlockVote login and a specific Ethereum address.

In a naive design, the contract enforces "one vote per Ethereum address". A user logs in as `voter1`, casts a vote with MetaMask account A, then switches MetaMask to account B (without logging out) and votes again. The contract sees two different `msg.sender` values, so both votes succeed. One human, two votes.

BlockVote prevents this in two layers:

1. **Database**: every voter row in SQLite has an `eth_address` column. This address is set by the admin at registration time and cannot be changed by the voter.
2. **Contract**: the voter's address is whitelisted per election via `addEligibleVoter`. Even if a voter's MetaMask were compromised and the attacker tried to vote with a different address, the contract would reject it.
3. **Frontend gate** (defense in depth): on page load, the app reads the bound `eth_address` from the JWT, compares it to the currently selected MetaMask account, and refuses to render anything if they don't match.

Combined: one BlockVote login = one Ethereum address = one vote per election.

---

## 4. The voting flow, step by step

### From the voter's perspective

1. Visits `/`, sees the login page.
2. Submits `voter_id` + `password`. The server queries SQLite, returns `{ token, role, eth_address }`.
3. Browser stores `bvBoundAddress` in `localStorage` and redirects to `/index.html?Authorization=Bearer <token>`.
4. Express middleware verifies the JWT before serving the page.
5. The bundle initializes: connects to MetaMask, requests account access.
6. Address-binding check: if the connected MetaMask account differs from `bvBoundAddress`, the page shows an error and stops.
7. Calls `getCountElections()` on the contract. For each election, calls `isEligible(electionId, account)`. Renders only elections where the result is `true`.
8. Voter selects an election tab. The page calls `getCandidate(...)` for each candidate and renders the cards. It also calls `checkVote(electionId)` to see if they've already voted.
9. Voter clicks a candidate → the radio is checked, the cast button enables.
10. Voter clicks **Cast Vote on Blockchain** → MetaMask prompts → voter signs.
11. Transaction is broadcast to Ganache. The contract runs its six `require` checks. If any fails, the transaction reverts and the user sees the revert reason. If all pass, the candidate's `voteCount` increments and the voter's address is marked as having voted.
12. After a 2-second confirmation delay, the page reloads to show the updated counts.

### From the contract's perspective

When `vote(electionId, candidateId)` is called:

```solidity
require(_electionId > 0 && _electionId <= countElections, "Invalid election");
require(eligibleVoters[_electionId][msg.sender], "Not eligible to vote in this election");
require(e.startDate > 0, "Voting period not set");
require(now >= e.startDate && now < e.endDate, "Not within voting period");
require(_candidateId > 0 && _candidateId <= e.countCandidates, "Invalid candidate");
require(!voters[_electionId][msg.sender], "Already voted in this election");

voters[_electionId][msg.sender] = true;
candidates[_electionId][_candidateId].voteCount++;
```

Six guards. Each reverts the entire transaction if it fails — no partial state change is possible. This is the entire vote logic.

---

## 5. The admin flow

The admin is the contract owner — the address that originally deployed `Voting.sol`. The contract enforces this with the `onlyOwner` modifier on every mutation.

### Admin journey

1. Log in as `admin / admin123`. MetaMask must be on the deployer account (`0x90F8…c9C1` for the deterministic Ganache).
2. **Voter Registry section** — fill in `voter_id`, `password`, and Ethereum address for each voter. The backend validates the address format (`/^0x[a-fA-F0-9]{40}$/`) and stores the row in SQLite. No transaction sent — this is purely off-chain.
3. **Create Election** — type a name, sign the transaction. `createElection(name)` runs on-chain, increments `countElections`, stores the new `Election` struct.
4. **Select the election** in the tab strip.
5. **Add Candidate** — name + party. Each click triggers a transaction signing. The contract increments `countCandidates` for that election and stores the candidate struct.
6. **Set Voting Period** — start and end dates. The frontend converts the `<input type="date">` value (a `YYYY-MM-DD` string) to Unix seconds via `Date.parse() / 1000`. Note: the date input has no time field, so the timestamp is interpreted as UTC midnight.
7. **Eligible Voters** — the page lists every registered voter with either `[ whitelist ]` button or `eligible` pill. Clicking the button calls `addEligibleVoter(electionId, voter.eth_address)` — another transaction. Once whitelisted, the voter can cast their ballot in this election.

### Why is voter registration off-chain but eligibility on-chain?

- Voter PII (the `voter_id`, password) is private — the chain is public. Putting credentials on-chain would expose them.
- Eligibility is a *policy decision* about the election. Putting it on-chain makes the election transparent: anyone can verify which addresses were allowed to vote, which closes the door to private vote-suppression.

---

## 6. Why these technology choices?

| Choice | Why |
|--------|-----|
| **Solidity 0.5.15** | Old, stable, widely understood by reviewers. The contract is simple enough that newer language features add nothing. |
| **Ganache** | A full local Ethereum node for development and demos. No real ETH, no waiting for blocks. With `--deterministic` it gives the same accounts every restart, which makes a class demo reproducible. |
| **Express + SQLite** | The smallest possible backend. SQLite is a single file — no server process to manage. Express handles routing, JWT, static serving in ~50 lines. |
| **JWT** | Stateless authentication: the server can verify a request without a session lookup. Carries the voter's role and bound address in the payload. |
| **MetaMask** | The most familiar Ethereum wallet. Voters who already have MetaMask need no new installation. |
| **Truffle + Browserify** | Truffle compiles and migrates the contract; Browserify bundles `app.js` (which uses CommonJS `require`) into a single browser-compatible script. |
| **Docker on Railway** | The app needs Node, npm dependencies, native binaries (`better-sqlite3`), and a long-running process. Docker captures all of that in two reproducible files. Railway handles HTTPS, persistent volumes, and auto-deploy on git push. |

---

## 7. Deterministic accounts

Ganache with `--deterministic` derives accounts from the well-known mnemonic
`myth like bonus scare over problem client lizard pioneer submit female collect`.
Account 0 is the contract deployer and is the BlockVote admin. The other 9 are available for voters.

| # | Address | Private Key | Role |
|---|---------|-------------|------|
| 0 | `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1` | `0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d` | Admin |
| 1 | `0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0` | `0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1` | Voter |
| 2 | `0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b` | `0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c` | Voter |
| 3 | `0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d` | `0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913` | Voter |
| 4 | `0xd03ea8624C8C5987235048901fB614fDcA89b117` | `0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743` | Voter |
| 5 | `0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC` | `0x395df67f0c2d2d9fe1ad08d1bc8b6627011959b79c53d7dd6a3536a33ab8a4fd` | Voter |
| 6 | `0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9` | `0xe485d098507f54e7733a205420dfddbe58db035fa577fc294ebd14db90767a52` | Voter |
| 7 | `0x28a8746e75304c0780E011BEd21C72cD78cd535E` | `0xa453611d9419d0e56f499079478fd72c37b251a94bfde4d19872c44cf65386e3` | Voter |
| 8 | `0xACa94ef8bD5ffEE41947b4585a84BdA5a3d3DA6E` | `0x829e924fdf021ba3dbbc4225edfece9aca04b929d6e75613329ca6f1d31c0bb4` | Voter |
| 9 | `0x1dF62f291b2E969fB0849d99D9Ce41e2F137006e` | `0xb0057716d5917badaf911b193b12b910811c1497b5bada8d7711f758981c3773` | Voter |

These keys are public knowledge — fine for a private dev chain, never to be used on mainnet.

---

## 8. The frontend aesthetic

The UI is built around a "terminal" aesthetic: JetBrains Mono everywhere, phosphor-green text on near-black, amber accents for important actions. Decorative motifs include `// section.name` headers (like Solidity comments), `[ button text ]` button framing (like a CLI prompt), `> ` prompts before labels, ASCII frames around panels, and a subtle CRT scanline overlay.

A light "paper-terminal" theme inverts the palette — deep forest green on cream — and disables the scanlines and vignette. Toggle persists in `localStorage` and is applied in `<head>` before paint to avoid the flash-of-wrong-theme problem.

This was a deliberate choice over the typical "modern dark dashboard with blue gradients" aesthetic that AI-generated frontends default to. The terminal look fits a blockchain product (which is, after all, a glorified CLI) and reads as intentional rather than templated.

---

## 9. Live deployment

The repo includes two Dockerfiles: one for the Node + Express + frontend service, one for the Ganache chain service. Both run on Railway as separate services in the same project. The chain service has a 1 GB persistent volume mounted at `/data` so chain state (deployed contract, votes, eligibility) survives restarts.

The contract deployment itself is a one-time act done from the developer's machine. We use `@truffle/hdwallet-provider` with the deterministic mnemonic to sign the migration transactions. Once deployed, the contract address is baked into `blockchain/build/contracts/Voting.json`, which is committed to the repo. The next time Railway rebuilds the app service, the bundled `app.js` reads the new address from that JSON file and the frontend connects to the new contract.

If you deploy a new contract version, you must:

1. `truffle migrate --network production --reset` — gets a new address
2. `npm run bundle` — picks up the new address
3. Commit and push `blockchain/build/contracts/Voting.json`
4. Wait for Railway to redeploy the app service

---

## 10. Limitations and what comes next

| Limitation | Why it exists | Possible fix |
|------------|---------------|--------------|
| Passwords stored in plaintext in SQLite | Demo simplicity | Hash with bcrypt before insert |
| Admin role is hardcoded as one row | Single-tenant project | Add an admin invitation flow |
| Anyone with the deterministic mnemonic controls all accounts | `--deterministic` is for reproducibility | For a real deployment, generate fresh accounts and securely hand out keys |
| Ganache is a private chain operated by us | Free hosting | Migrate to a public testnet (Sepolia) or L2 |
| No vote receipt / verifiability for voters | Out of scope for v1 | Issue a signed receipt the voter can later check against the chain |
| No revocation of eligibility | Contract has no `removeEligibleVoter` | Add that function with `onlyOwner` |
| No election deletion | Contract is append-only by design | Probably leave as is — deletion would defeat the audit trail |

---

## 11. Where to read further

- [docs/architecture.md](architecture.md) — diagrams of every flow and the layer map
- [docs/code-explained.md](code-explained.md) — every file, every function
- [docs/how-to-run.txt](how-to-run.txt) — the shortest path from clone to running
- [README.md](../README.md) — the elevator-pitch view
