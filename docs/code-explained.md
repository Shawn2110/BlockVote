# BlockVote — Complete Code Explanation

Every file, every function, explained in plain terms.

---

## Table of Contents

1. [Smart Contract — `blockchain/contracts/Voting.sol`](#1-smart-contract)
2. [Backend Server — `backend/server.js`](#2-backend-server)
3. [Auth Route — `backend/routes/auth.js`](#3-auth-route)
4. [JWT Middleware — `backend/middleware/auth.js`](#4-jwt-middleware)
5. [Database Setup — `backend/db/database.js`](#5-database-setup)
6. [Database Seed — `backend/db/seed.js`](#6-database-seed)
7. [Login Script — `frontend/js/login.js`](#7-login-script)
8. [App Script — `frontend/js/app.js`](#8-app-script)

---

## 1. Smart Contract

**File:** `blockchain/contracts/Voting.sol`

This is the heart of the system. Once deployed to the blockchain, its data is permanent and tamper-proof. No one — not even the developer — can alter recorded votes. The contract now supports multiple independent elections, each with their own candidates, voting period, and voter registry.

### Structs

```solidity
struct Candidate {
    uint id;
    string name;
    string party;
    uint voteCount;
}
```
A blueprint for a candidate record — bundles the four fields together so they can be stored as one unit.

```solidity
struct Election {
    uint id;
    string name;
    uint256 startDate;
    uint256 endDate;
    uint countCandidates;
}
```
A blueprint for an election record. `startDate` and `endDate` are Unix timestamps (seconds since 1970). `countCandidates` acts as both a running count and the next candidate ID.

---

### State Variables

```solidity
uint public countElections;
```
Running total of created elections. Starts at 0. Incremented each time `createElection` is called.

```solidity
mapping(uint => Election) public elections;
```
A dictionary: election ID → Election struct. Solidity's `mapping` is like a hash map. `public` lets anyone read any entry directly.

```solidity
mapping(uint => mapping(uint => Candidate)) public candidates;
```
A nested mapping: `candidates[electionId][candidateId]` → Candidate struct. Each election has its own independent candidate list.

```solidity
mapping(uint => mapping(address => bool)) public voters;
```
A nested mapping: `voters[electionId][walletAddress]` → bool. Tracks who has voted in which election. One vote per address per election — completely independent across elections.

---

### `createElection(string memory _name) → uint`

**What it does:** Creates a new named election on-chain and returns its ID.

**How it works:**
1. `require(bytes(_name).length > 0)` — rejects empty names.
2. Increments `countElections` — so IDs start at 1, never 0.
3. Stores a new `Election` struct with `startDate`, `endDate`, and `countCandidates` all initialised to 0.
4. Returns the new election's ID.

**Who calls it:** Admin, via MetaMask on the admin dashboard.

---

### `getCountElections() → uint`

**What it does:** Returns how many elections exist on-chain.

**Used by:** `app.js` on both pages to know how many tabs to render in the election tab strip.

---

### `getElection(uint _electionId) → (uint, string, uint256, uint256, uint)`

**What it does:** Returns all five fields of an election — `(id, name, startDate, endDate, countCandidates)`.

**How it works:** Reads `elections[_electionId]` from storage and returns its fields as a tuple.

**Used by:** `app.js` when a tab is clicked — fetches the election name and dates to display, and the candidate count to know how many `getCandidate` calls to make.

---

### `setDates(uint _electionId, uint256 _start, uint256 _end)`

**What it does:** Sets the voting window for a specific election. Can be called multiple times (admins can adjust dates as needed).

**How it works:**
- `require(_electionId > 0 && _electionId <= countElections)` — ensures the election exists.
- `require(_end > _start)` — end must come after start.
- Assigns `startDate` and `endDate` on the election struct.

**Who calls it:** Admin, after selecting an election tab on the admin page.

---

### `getDates(uint _electionId) → (uint256, uint256)`

**What it does:** Returns the `(startDate, endDate)` pair for an election.

**Used by:** `app.js` to display the voting period badge on the voter page.

---

### `addCandidate(uint _electionId, string memory _name, string memory _party) → uint`

**What it does:** Registers a new candidate under a specific election.

**How it works:**
1. Validates the election ID.
2. Increments `elections[_electionId].countCandidates` — the new candidate's ID.
3. Stores the `Candidate` struct in `candidates[_electionId][newId]`.
4. Returns the new candidate ID.

**Who calls it:** Admin, after selecting an election tab on the admin page.

---

### `getCountCandidates(uint _electionId) → uint`

**What it does:** Returns the number of candidates registered in a specific election.

**Used by:** `app.js` to know how many `getCandidate()` calls to fire in parallel.

---

### `getCandidate(uint _electionId, uint _candidateId) → (uint, string, string, uint)`

**What it does:** Returns all four fields for a candidate in a given election — `(id, name, party, voteCount)`.

**Used by:** `app.js` in a `Promise.all` parallel fetch — gets all candidates at once before rendering the candidate cards.

---

### `vote(uint _electionId, uint _candidateId)`

**What it does:** Records a vote for a candidate in a specific election. The core on-chain action.

**How it works — five `require` guards (any failure reverts and costs no net ETH):**

1. `require(_electionId > 0 && _electionId <= countElections)` — election must exist.
2. `require(e.startDate > 0)` — voting period must have been set by the admin.
3. `require(now >= e.startDate && now < e.endDate)` — must be within the open voting window. `now` is Solidity's alias for `block.timestamp`.
4. `require(_candidateId > 0 && _candidateId <= e.countCandidates)` — candidate must exist in this election.
5. `require(!voters[_electionId][msg.sender])` — this wallet must not have already voted in this election. `msg.sender` is the Ethereum address that signed the transaction (the MetaMask wallet).

**After all checks pass:**
- `voters[_electionId][msg.sender] = true` — marks this address as voted in this election.
- `candidates[_electionId][_candidateId].voteCount++` — increments the chosen candidate's count.

**Key property:** Stored permanently on-chain. Immutable once mined. A voter can vote in multiple elections but only once per election.

---

### `checkVote(uint _electionId) → bool`

**What it does:** Returns `true` if the calling address has already voted in the given election.

**How it works:** Reads `voters[_electionId][msg.sender]`.

**`view` keyword:** Read-only — costs no gas.

**Used by:** `app.js` after an election tab is selected, to decide whether to show "already voted" or enable the vote button.

---

## 2. Backend Server

**File:** `backend/server.js`

The single Node.js process that serves the entire web app. Uses Express.js.

### Setup

```js
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
```
Loads environment variables from `.env` at the project root. `SECRET_KEY` loaded here is used by the JWT middleware.

```js
const authRouter    = require('./routes/auth');
const authorizeUser = require('./middleware/auth');
```
Imports the login route handler and JWT middleware.

### `app.use(authRouter)`

Mounts the auth router globally. When a request comes in for `GET /login`, Express routes it to `routes/auth.js` before anything else.

### Static asset routes (`/css/:file`, `/js/:file`, `/dist/:file`)

Each uses `req.params.file` to serve the matching file from `frontend/`. No auth check — CSS and JS must be publicly accessible so the login page itself can load.

### `app.get('/index.html', authorizeUser, ...)`

`authorizeUser` runs first. If the JWT check fails the response ends with 401. Only with a valid token does Express call `res.sendFile(...)`. Same pattern applies to `/admin.html`.

### `app.get('/')`

Serves `frontend/html/login.html` with no auth check — the public entry point.

### `app.listen(8080)`

Binds the server to port 8080.

---

## 3. Auth Route

**File:** `backend/routes/auth.js`

Handles the single login endpoint.

### `GET /login?voter_id=&password=`

**Step 1 — Input validation:**
```js
if (!voter_id || !password) {
    return res.status(400).json({ message: 'voter_id and password are required' });
}
```
Returns 400 Bad Request if either field is missing.

**Step 2 — Database lookup:**
```js
const voter = db
  .prepare('SELECT role FROM voters WHERE voter_id = ? AND password = ?')
  .get(voter_id, password);
```
- `.prepare()` compiles the SQL once.
- `.get()` returns the first matching row, or `undefined`.
- `?` placeholders are parameterised — values are never interpolated into the SQL string, preventing SQL injection.

**Step 3 — Not found:**
```js
if (!voter) return res.status(401).json({ message: 'Invalid Voter ID or password' });
```
Deliberately vague — doesn't reveal whether the ID or password was wrong.

**Step 4 — Sign JWT:**
```js
const token = jwt.sign(
    { voter_id, role: voter.role },
    process.env.SECRET_KEY,
    { algorithm: 'HS256' }
);
```
Creates a signed JSON Web Token containing `voter_id` and `role`. Signed with HMAC-SHA256. Anyone can read the payload, but cannot forge one without `SECRET_KEY`.

**Step 5 — Respond:**
```js
return res.json({ token, role: voter.role });
```
The frontend uses `role` to redirect to the right page, and stores `token` in sessionStorage.

---

## 4. JWT Middleware

**File:** `backend/middleware/auth.js`

Runs before protected route handlers to verify the caller is authenticated.

### `authorizeUser(req, res, next)`

Express middleware receives three arguments: the request, response, and `next` (passes control to the next handler).

**Step 1 — Extract token:**
```js
const token = req.query.Authorization?.split('Bearer ')[1];
```
Reads the `Authorization` query parameter. `?.` is optional chaining — safe if the param is absent. Strips the `Bearer ` prefix to get the raw token.

**Step 2 — Missing token:**
```js
if (!token) return res.status(401).send('<h1 align="center"> Login to Continue </h1>');
```
Serves a plain HTML message if the user navigated directly without logging in.

**Step 3 — Verify:**
```js
const decodedToken = jwt.verify(token, process.env.SECRET_KEY, { algorithms: ['HS256'] });
req.user = decodedToken;
next();
```
`jwt.verify` checks signature and expiry. Decoded payload (`{ voter_id, role, iat }`) is attached to `req.user`. `next()` passes control to the route's `sendFile` call.

**Step 4 — Invalid token:**
```js
} catch (error) {
    return res.status(401).json({ message: 'Invalid authorization token' });
}
```
`jwt.verify` throws for malformed, bad-signature, or expired tokens.

---

## 5. Database Setup

**File:** `backend/db/database.js`

Creates and exports the SQLite connection. Required by both `routes/auth.js` and `seed.js`.

```js
const db = new Database(path.join(__dirname, '..', 'voters.db'));
```
Opens (or creates) `backend/voters.db`. `better-sqlite3` is synchronous — no callbacks.

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role     TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  )
`);
```
- `CREATE TABLE IF NOT EXISTS` — safe to run on every module load.
- `CHECK(role IN ('admin', 'user'))` — SQLite constraint rejecting any other role value.

```js
module.exports = db;
```
Node's `require()` cache means every file that imports this module gets the same connection instance.

---

## 6. Database Seed

**File:** `backend/db/seed.js`

Run once via `npm run seed` to populate demo accounts.

### Voter list

11 hardcoded records — one admin (`admin` / `admin123`) and ten voters (`voter1`–`voter10` / `pass1`–`pass10`).

### `INSERT OR IGNORE`

Silently skips rows whose `voter_id` already exists. Safe to run multiple times.

### `db.transaction()`

```js
const seedAll = db.transaction(() => {
    for (const v of voters) insert.run(v.voter_id, v.password, v.role);
});
seedAll();
```
Wraps all 11 inserts in one SQLite transaction — commits to disk once, not eleven times. All-or-nothing: if any insert fails, none are committed.

---

## 7. Login Script

**File:** `frontend/js/login.js`

Runs in the browser. Handles form submission on the login page.

### Form submit listener

Attached with `preventDefault()` to stop the browser's default POST navigation.

### Input validation

Trims both inputs and shows an error if either is empty — before making any network request.

### Spinner UI

Hides the submit button and shows a spinner while the fetch is in flight. Gives immediate visual feedback.

### `fetch('/login?voter_id=...&password=...')`

Same-origin `GET` request to the Express server — no CORS issue. `encodeURIComponent()` applied to both values so special characters don't break the URL.

### Response handling

- **200 OK** → parse JSON, read `data.role`.
  - `admin` → redirect to `/admin.html?Authorization=Bearer <token>`
  - `user` → redirect to `/index.html?Authorization=Bearer <token>`
- **Non-OK** → show the error message from the server.

### Error handling

`.catch()` catches network failures, shows the message, and re-enables the submit button.

---

## 8. App Script

**File:** `frontend/js/app.js`

Runs in the browser as a Browserified bundle. Handles all blockchain interaction for both voter and admin pages. The same script powers both — it detects which page it is on via `document.title`.

### Module imports

```js
const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../blockchain/build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts);
```
- `Web3` — the Ethereum JS library.
- `@truffle/contract` — wraps the raw ABI into a promise-based interface.
- `votingArtifacts` — compiled contract JSON with ABI and deployed address.
- `VotingContract` — the contract abstraction, not yet connected to a provider.

### Module-level state

```js
window.App = {
  instance: null,          // the connected contract instance
  selectedElectionId: null // which election tab is active
}
```
Both are set during the session and read by every function that interacts with the contract.

---

### `App.eventStart()` — async

Entry point, called once on `window.load`.

```js
await window.ethereum.request({ method: 'eth_requestAccounts' });
```
Triggers the MetaMask popup to connect the wallet. `await` ensures the address is available before proceeding.

```js
VotingContract.setProvider(window.ethereum);
VotingContract.defaults({ from: window.ethereum.selectedAddress, gas: 6654755 });
```
Wires up MetaMask as the Web3 provider. `defaults` pre-fills `from` and gas limit on every transaction.

**Contract connection (with fallback):**
```js
try {
    App.instance = await VotingContract.deployed();
} catch (err) {
    // Fallback: use the address directly from the build artifacts
    var latestAddress = networks[networkKeys[networkKeys.length - 1]].address;
    App.instance = await VotingContract.at(latestAddress);
}
```
`deployed()` requires the network ID in MetaMask to match the one in the build artifacts. If there's a mismatch (common in Codespaces), the fallback reads the contract address directly from the JSON and connects with `at()`.

After connecting, calls either `App.initAdmin()` or `App.initVoter()` based on the page title.

---

### `App.initAdmin()`

Calls `App.loadElectionTabs('admin')` to render the tab strip, then registers click handlers for the three admin buttons:

- **`#createElectionBtn`** — reads the election name input, calls `instance.createElection(name)`, then reloads the tab strip on success.
- **`#addCandidate`** — validates that an election is selected and both fields are filled, calls `instance.addCandidate(selectedElectionId, name, party)`, then refreshes the candidate list.
- **`#addDate`** — converts `YYYY-MM-DD` date strings to Unix seconds (`Date.parse() / 1000`), calls `instance.setDates(selectedElectionId, start, end)`.

---

### `App.initVoter()`

Calls `App.loadElectionTabs('voter')` to render the election tabs on the voter page.

---

### `App.loadElectionTabs(mode)`

Fetches all elections from the chain and renders the tab strip.

**How it works:**
1. Calls `instance.getCountElections()` to get the total.
2. Fires `instance.getElection(i)` for every election ID in parallel via `Promise.all`.
3. Builds a row of `<button class="election-tab">` elements, one per election.
4. Auto-selects the first election by calling `App.selectElection(id, mode)`.

`mode` is either `'admin'` or `'voter'` — determines which DOM element the tabs are rendered into and which behaviour `selectElection` uses.

---

### `App.selectElection(electionId, mode)`

Called when a tab is clicked (or auto-selected on load).

1. Sets `App.selectedElectionId = electionId`.
2. Adds the `active` CSS class to the clicked tab, removes it from others.
3. Calls `instance.getElection(electionId)` to fetch the election name and dates.

**Admin path:**
- Shows the "Managing: [name]" banner.
- Reveals the `#electionManagement` panel.
- Calls `App.loadCandidates()` for the admin candidate list.

**Voter path:**
- Sets `#electionTitle` to the election name.
- Formats and displays the voting period badge. If `startDate === 0`, shows "Voting period not set yet".
- Shows the `#electionView` panel.
- Resets the vote message and disables the vote button (re-enabled only after a candidate is selected).
- Calls `App.loadCandidates()` for the voter candidate cards.
- Calls `instance.checkVote(electionId)` — if already voted, disables the button and shows the "already voted" message.

---

### `App.loadCandidates(instance, electionId)`

Fetches and renders all candidates for a given election.

**Step 1 — count:**
```js
instance.getCountCandidates(electionId).then(function(countRaw) {
```
Gets how many candidates exist. Shows empty state if 0.

**Step 2 — parallel fetch:**
```js
var promises = [];
for (var i = 1; i <= count; i++) promises.push(instance.getCandidate(electionId, i));
Promise.all(promises).then(function(candidates) {
```
Fires all `getCandidate(electionId, id)` calls simultaneously. For N candidates this is N× faster than sequential awaits.

**Step 3 — vote percentage:**
```js
var totalVotes = candidates.reduce((sum, c) => sum + parseInt(c[3]), 0);
var percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
```
Computes each candidate's share of votes so far.

**Step 4 — page detection:**
```js
var isAdminPage = document.title.includes('Admin');
```
- **Admin:** Renders compact rows — name, party badge, vote count.
- **Voter:** Renders interactive cards — avatar, name, party badge, progress bar, radio input.

**Step 5 — progress bar animation:**
```js
setTimeout(function() {
    $('.vote-bar-fill').each(function() { $(this).css('width', $(this).data('width')); });
}, 100);
```
Sets initial bar width to `0%` in HTML, then triggers CSS transitions after 100ms for a smooth fill-in effect.

---

### `App.selectCandidate(el, id)`

Called by `onclick` on each candidate card.

1. Removes `selected` from all cards.
2. Unchecks all radio inputs.
3. Adds `selected` to the clicked card.
4. Checks the hidden radio input (`#c<id>`).
5. Enables the vote button (voter hasn't voted yet — this state is confirmed by `checkVote`).

---

### `App.vote()`

Called when "Cast Vote on Blockchain" is clicked.

**Step 1 — guard checks:**
```js
if (!App.selectedElectionId) { ... show error ... return; }
var candidateID = $("input[name='candidate']:checked").val();
if (!candidateID) { ... show error ... return; }
```
Verifies both an election and a candidate have been selected.

**Step 2 — UI feedback:**
Disables the button, shows "Waiting for blockchain confirmation..." so the user knows a MetaMask popup is coming.

**Step 3 — submit transaction:**
```js
App.instance.vote(App.selectedElectionId, parseInt(candidateID))
```
`parseInt` ensures a number is passed, not a string. MetaMask pops up for the user to confirm and sign the transaction.

**Step 4 — success:**
Shows "Vote cast successfully!" and reloads after 2 seconds so updated vote counts are fetched fresh from the chain.

**Step 5 — failure:**
`.catch()` shows the revert reason from the contract (e.g. "Not within voting period", "Already voted") and re-enables the button.

---

### `window.addEventListener('load', ...)`

```js
if (typeof window.ethereum !== 'undefined') {
    window.eth = new Web3(window.ethereum);
} else {
    window.eth = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
}
window.App.eventStart();
```
Runs once the page fully loads.

- MetaMask present → uses it as the Web3 provider (wallet signs transactions).
- MetaMask absent → falls back to a direct HTTP connection to Ganache. Read operations still work; write operations (voting) will not.

Calls `App.eventStart()` to kick off everything.
