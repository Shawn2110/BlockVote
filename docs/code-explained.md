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

This is the heart of the system. Once deployed to the blockchain, its data is permanent and tamper-proof. No one — not even the developer — can alter recorded votes.

### State Variables

```solidity
mapping (uint => Candidate) public candidates;
```
A dictionary keyed by integer ID, storing each candidate's details. `mapping` is Solidity's equivalent of a hash map. `public` means anyone can read it.

```solidity
mapping (address => bool) public voters;
```
Tracks which Ethereum wallet addresses have already voted. `address` is a 20-byte Ethereum account identifier. Once set to `true`, it can never be unset — preventing double voting.

```solidity
uint public countCandidates;
```
Running total of registered candidates. Starts at 0 when the contract is deployed.

```solidity
uint256 public votingStart;
uint256 public votingEnd;
```
Unix timestamps (seconds since 1970) defining the window during which votes are accepted.

### Struct

```solidity
struct Candidate {
    uint id;
    string name;
    string party;
    uint voteCount;
}
```
A blueprint for a candidate record. Bundles four fields together so they can be stored as one unit in the `candidates` mapping.

---

### `addCandidate(string name, string party)`

**What it does:** Registers a new candidate on the blockchain.

**How it works:**
1. Increments `countCandidates` (so IDs start at 1, not 0).
2. Creates a new `Candidate` struct with that ID, the given name and party, and a `voteCount` of 0.
3. Stores it in the `candidates` mapping under the new ID.
4. Returns the new candidate's ID.

**Who calls it:** Admin, via MetaMask on the admin dashboard.

**No access control:** Any Ethereum address can technically call this. In a production system you would restrict it to the contract owner.

---

### `vote(uint candidateID)`

**What it does:** Records a vote for the given candidate. This is the core function.

**How it works — three `require` guards (any failure reverts the transaction):**

1. `require((votingStart <= now) && (votingEnd > now))`
   Checks that the current block timestamp is within the voting window. `now` in Solidity is an alias for `block.timestamp`.

2. `require(candidateID > 0 && candidateID <= countCandidates)`
   Ensures the chosen candidate ID actually exists. Prevents voting for a non-existent candidate.

3. `require(!voters[msg.sender])`
   Checks that the calling wallet address has not already voted. `msg.sender` is the Ethereum address that sent the transaction (MetaMask wallet in our case).

**After all checks pass:**
- Sets `voters[msg.sender] = true` — marks this address as having voted.
- Increments `candidates[candidateID].voteCount` — adds one to the chosen candidate.

**Key property:** Because this runs on the blockchain, the vote record is immutable the moment the transaction is mined.

---

### `checkVote()`

**What it does:** Returns `true` if the calling address has already voted, `false` otherwise.

**How it works:** Looks up `voters[msg.sender]` and returns the boolean.

**`view` keyword:** Declares that this function only reads state, never writes it. This means it costs no gas.

**Used by:** `app.js` on page load to decide whether to enable or disable the "Cast Vote" button.

---

### `getCountCandidates()`

**What it does:** Returns the total number of registered candidates.

**Used by:** `app.js` to know how many times to call `getCandidate()` when loading the candidate list.

---

### `getCandidate(uint candidateID)`

**What it does:** Returns all four fields for a given candidate — `(id, name, party, voteCount)`.

**How it works:** Looks up `candidates[candidateID]` and returns its fields as a tuple.

**Used by:** `app.js` in a `Promise.all` loop — it fetches all candidates in parallel then renders them.

---

### `setDates(uint256 _startDate, uint256 _endDate)`

**What it does:** Sets the voting period. Can only be called once.

**How it works — one compound `require`:**
- `votingEnd == 0 && votingStart == 0` — both must still be at their zero default, meaning dates have never been set. This is the one-time-only lock.
- `_startDate + 1000000 > now` — the start date must be reasonably close to the present (within ~11.5 days), preventing a start date set years in the past.
- `_endDate > _startDate` — end must come after start.

**After checks pass:** Assigns `votingStart` and `votingEnd` from the parameters.

**Used by:** Admin via MetaMask on the admin dashboard.

---

### `getDates()`

**What it does:** Returns both `votingStart` and `votingEnd` as a tuple.

**Used by:** `app.js` to display the voting period at the top of the voter and admin pages.

---

## 2. Backend Server

**File:** `backend/server.js`

The single Node.js process that serves the entire web app. Uses Express.js.

### Setup

```js
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
```
Loads environment variables from the `.env` file at the project root (one directory up from `backend/`). The `SECRET_KEY` variable loaded here is used by the JWT middleware.

```js
const authRouter = require('./routes/auth');
const authorizeUser = require('./middleware/auth');
```
Imports the login route handler and the JWT verification middleware from their respective files.

### `app.use(authRouter)`

Mounts the auth router at the application level. This means when a request comes in for `GET /login`, Express passes it to `routes/auth.js` before checking any other route.

### Static asset routes (`/css/:file`, `/js/:file`, `/assets/:file`, `/dist/:file`, `/favicon.ico`)

Each uses `req.params.file` to grab the filename from the URL and serves the corresponding file from the `frontend/` directory.

Example: `GET /css/login.css` → serves `frontend/css/login.css`.

These routes have no auth check — CSS and JS must be publicly accessible so the login page itself can load.

### `app.get('/index.html', authorizeUser, ...)`

The `authorizeUser` middleware runs first. If the JWT check fails, the response ends with a 401 and the file is never served. Only if the token is valid does Express proceed to `res.sendFile(...)`.

Same pattern applies to `/admin.html`.

### `app.get('/')`

Serves `frontend/html/login.html` with no auth check. This is the public entry point.

### `app.listen(8080, ...)`

Binds the server to port 8080 and logs a confirmation message to the terminal.

---

## 3. Auth Route

**File:** `backend/routes/auth.js`

Handles the single login endpoint that replaces the old Python FastAPI service.

### `GET /login?voter_id=&password=`

**Step 1 — Input validation:**
```js
if (!voter_id || !password) {
    return res.status(400).json({ message: 'voter_id and password are required' });
}
```
Returns 400 Bad Request if either field is missing. Stops processing early.

**Step 2 — Database lookup:**
```js
const voter = db
  .prepare('SELECT role FROM voters WHERE voter_id = ? AND password = ?')
  .get(voter_id, password);
```
Uses `better-sqlite3`'s `.prepare().get()` pattern:
- `.prepare()` compiles the SQL statement once (efficient for repeated use).
- `.get()` executes it and returns the first matching row, or `undefined` if none.
- The `?` placeholders are parameterised — values are never interpolated directly into the SQL string, preventing SQL injection.

**Step 3 — Not found:**
```js
if (!voter) {
    return res.status(401).json({ message: 'Invalid Voter ID or password' });
}
```
Returns 401 Unauthorized. Deliberately vague — doesn't reveal whether the ID or password was wrong.

**Step 4 — Sign JWT:**
```js
const token = jwt.sign(
    { voter_id, role: voter.role },
    process.env.SECRET_KEY,
    { algorithm: 'HS256' }
);
```
Creates a signed JSON Web Token containing `voter_id` and `role`. The token is signed with `SECRET_KEY` using HMAC-SHA256. Anyone with the token can read its payload, but they cannot forge a new one without knowing the secret key.

**Step 5 — Respond:**
```js
return res.json({ token, role: voter.role });
```
Returns the token and role. The frontend uses `role` to decide which page to redirect to, and stores `token` in `localStorage`.

---

## 4. JWT Middleware

**File:** `backend/middleware/auth.js`

A function that runs before protected route handlers to verify the caller is authenticated.

### `authorizeUser(req, res, next)`

Express middleware always receives three arguments: the request, the response, and `next` (a function to call to pass control to the next handler).

**Step 1 — Extract token:**
```js
const token = req.query.Authorization?.split('Bearer ')[1];
```
Reads the `Authorization` query parameter (e.g. `?Authorization=Bearer eyJ...`). The `?.` is optional chaining — safely returns `undefined` if `Authorization` is absent. `.split('Bearer ')[1]` strips the `Bearer ` prefix and grabs just the token string.

**Step 2 — Missing token:**
```js
if (!token) {
    return res.status(401).send('<h1 align="center"> Login to Continue </h1>');
}
```
If there's no token at all, the user probably navigated directly to `/index.html` without logging in. Serves a plain HTML message instead of a JSON error (since this is a browser page, not an API call).

**Step 3 — Verify token:**
```js
const decodedToken = jwt.verify(token, process.env.SECRET_KEY, { algorithms: ['HS256'] });
req.user = decodedToken;
next();
```
`jwt.verify` both verifies the signature (using `SECRET_KEY`) and checks the token hasn't expired. If valid, it returns the decoded payload `{ voter_id, role, iat }`. This is attached to `req.user` so downstream route handlers can access it.

`next()` hands control to the next middleware or route handler — in this case, the `res.sendFile(...)` call in `server.js`.

**Step 4 — Invalid token:**
```js
} catch (error) {
    return res.status(401).json({ message: 'Invalid authorization token' });
}
```
`jwt.verify` throws if the token is malformed, has a bad signature, or has expired. The catch block returns 401.

---

## 5. Database Setup

**File:** `backend/db/database.js`

Creates and exports the SQLite database connection. This module is required by both `routes/auth.js` and `seed.js`.

```js
const db = new Database(path.join(__dirname, '..', 'voters.db'));
```
Opens (or creates) the SQLite database file at `backend/voters.db`. `better-sqlite3` opens connections synchronously — no callbacks or promises needed.

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role     TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  )
`);
```
Runs a raw SQL statement:
- `CREATE TABLE IF NOT EXISTS` — idempotent; safe to run every time the module loads.
- `voter_id TEXT PRIMARY KEY` — unique identifier, cannot be null.
- `CHECK(role IN ('admin', 'user'))` — SQLite constraint that rejects any row with a role other than those two values.

```js
module.exports = db;
```
Exports the single database connection object. Because Node.js caches `require()` calls, every file that requires this module gets the same connection instance.

---

## 6. Database Seed

**File:** `backend/db/seed.js`

Run once (via `npm run seed`) to populate the voters table with demo accounts.

### Voter list

11 hardcoded records — one admin and ten voters — with their IDs, plaintext passwords, and roles.

### `db.prepare('INSERT OR IGNORE ...')`

`INSERT OR IGNORE` silently skips any row whose `voter_id` already exists in the table (because `voter_id` is the PRIMARY KEY). This makes the seed script safe to run multiple times without duplicating data.

### `db.transaction()`

```js
const seedAll = db.transaction(() => {
    for (const v of voters) {
        insert.run(v.voter_id, v.password, v.role);
    }
});
seedAll();
```
Wraps all 11 inserts in a single SQLite transaction. This is significantly faster than 11 separate transactions (SQLite commits to disk once instead of eleven times) and ensures all-or-nothing insertion — if one insert fails, none are committed.

---

## 7. Login Script

**File:** `frontend/js/login.js`

Runs in the browser. Handles form submission on the login page.

### Event listener on `loginForm`

Attached to the form's `submit` event with `preventDefault()` to stop the default browser form POST navigation.

### Input validation

```js
if (!voter_id || !password) {
    errorMsg.textContent = 'Please enter your Voter ID and password.';
    return;
}
```
Client-side guard before making any network request. Trims whitespace from both inputs first.

### Spinner UI

Hides the "Sign In" button text and shows a spinner element while the request is in flight. Gives the user immediate visual feedback.

### `fetch('/login?voter_id=...&password=...')`

Makes a `GET` request to the Express server. Because the frontend is served from the same origin (`localhost:8080`), there is no CORS issue. Query parameters carry the credentials.

`encodeURIComponent()` is applied to both values — ensures special characters (spaces, `&`, `=`) in the voter ID or password don't break the URL.

### Response handling

- `response.ok` (HTTP 200–299): parse JSON, read `data.role`.
  - `role === 'admin'` → store `jwtTokenAdmin` in `localStorage`, redirect to `/admin.html?Authorization=Bearer <token>`
  - `role === 'user'` → store `jwtTokenVoter` in `localStorage`, redirect to `/index.html?Authorization=Bearer <token>`
- Non-OK response: throw an error with the message text.

### Error handling

`.catch()` receives any thrown error, displays its message in `#error-msg`, and re-enables the submit button.

---

## 8. App Script

**File:** `frontend/js/app.js`

Runs in the browser (loaded as a Browserified bundle). Handles all blockchain interaction for both the voter and admin pages — the same script powers both because it detects which page it is on by checking `document.title`.

### Module imports

```js
const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../blockchain/build/contracts/Voting.json');
```
- `Web3` — the Ethereum JavaScript library.
- `@truffle/contract` — wraps the raw ABI into a friendlier promise-based interface.
- `votingArtifacts` — the compiled contract JSON generated by `truffle compile`. Contains the ABI (interface definition) and the deployed contract address on Ganache.

```js
var VotingContract = contract(votingArtifacts);
```
Creates a contract abstraction. Not connected to a provider yet — that happens in `eventStart`.

---

### `App.eventStart()`

Entry point. Called once on `window.load`.

```js
window.ethereum.request({ method: 'eth_requestAccounts' });
```
Triggers the MetaMask popup asking the user to connect their wallet. This is required before any read or write operation.

```js
VotingContract.setProvider(window.ethereum);
VotingContract.defaults({ from: window.ethereum.selectedAddress, gas: 6654755 });
```
Connects the contract abstraction to MetaMask's injected provider. All future contract calls will use MetaMask for signing. `defaults` pre-fills the `from` address (the connected wallet) and a gas limit on every transaction.

```js
App.account = window.ethereum.selectedAddress;
```
Caches the connected wallet address locally.

**Truncated address display:**
```js
var short = addr.slice(0, 6) + '...' + addr.slice(-4);
```
Shows e.g. `0xAD17...6306` in the header rather than the full 42-character address.

**`instance.getDates()`** — reads `votingStart` and `votingEnd` from the contract. Converts the Unix timestamps to human-readable dates using `toLocaleDateString`. If `result[0]` is 0, the admin hasn't set dates yet.

**`instance.checkVote()`** — reads the `voters[msg.sender]` mapping. If `true`, disables the vote button and shows "You have already cast your vote."

**Admin controls (inside `$(document).ready`):**

The `#addCandidate` and `#addDate` click handlers only exist in the DOM on `admin.html`, so they simply do nothing on the voter page.

---

### `#addCandidate` click handler

1. Reads `#name` and `#party` input values. Shows error if either is empty.
2. Disables the button and shows "Adding..." text.
3. Calls `instance.addCandidate(name, party)` — this triggers a MetaMask transaction.
4. On success: shows success message, clears inputs, re-enables button, calls `App.loadCandidates()` to refresh the list.
5. On failure: shows error text, re-enables button.

---

### `#addDate` click handler

1. Reads `#startDate` and `#endDate` input values. `Date.parse()` converts them from `YYYY-MM-DD` strings to milliseconds; dividing by 1000 converts to Unix seconds (which the Solidity contract expects).
2. Calls `instance.setDates(startDate, endDate)` — MetaMask transaction.
3. On success: shows success message, re-enables button.
4. On failure: shows error, re-enables button.

---

### `App.loadCandidates(instance)`

Fetches and renders all candidates from the blockchain.

**Step 1:**
```js
instance.getCountCandidates().then(function(countCandidates) {
```
Gets the total number of candidates. If 0, shows an "empty state" message and returns early.

**Step 2 — parallel fetch:**
```js
var promises = [];
for (var i = 1; i <= count; i++) {
    promises.push(instance.getCandidate(i));
}
Promise.all(promises).then(function(candidates) {
```
Fires all `getCandidate(id)` calls simultaneously rather than sequentially. `Promise.all` resolves when every call has returned, giving an array of candidate tuples. For N candidates this is N times faster than sequential awaits.

**Step 3 — vote percentage:**
```js
var totalVotes = candidates.reduce((sum, c) => sum + parseInt(c[3]), 0);
var percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
```
Calculates each candidate's share of the total votes cast so far.

**Step 4 — page detection:**
```js
var isAdminPage = document.title.includes('Admin');
```
Uses the page `<title>` tag to decide which template to render:
- **Admin page:** Simple horizontal rows showing name, party, and vote count.
- **Voter page:** Interactive cards with radio buttons, progress bars, and percentage display.

**Step 5 — progress bar animation:**
```js
setTimeout(function() {
    $('.vote-bar-fill').each(function() {
        $(this).css('width', $(this).data('width'));
    });
}, 100);
```
Sets the bars' initial width to `0%` in the HTML, then after a 100ms delay triggers CSS transitions to animate them to their real widths. This creates a smooth fill-in effect on load.

---

### `App.selectCandidate(el, id)`

Called by the `onclick` attribute on each candidate card.

1. Removes the `selected` CSS class from all candidate cards.
2. Unchecks all radio buttons.
3. Adds `selected` to the clicked card.
4. Checks the corresponding hidden radio input (`#c<id>`).

The radio input isn't shown to the user — it's used by `App.vote()` to know which candidate was chosen.

---

### `App.vote()`

Called when the "Cast Vote on Blockchain" button is clicked.

**Step 1 — read selection:**
```js
var candidateID = $("input[name='candidate']:checked").val();
if (!candidateID) { ... show error ... return; }
```
Finds the checked radio button. If none is checked (user hasn't selected a candidate), shows an error and returns without doing anything.

**Step 2 — UI feedback:**
Disables the button and shows "Waiting for blockchain confirmation..." so the user knows the transaction is in flight (MetaMask confirmations can take a few seconds).

**Step 3 — submit transaction:**
```js
VotingContract.deployed().then(function(instance) {
    instance.vote(parseInt(candidateID)).then(function() {
```
`parseInt` ensures the candidate ID is a number, not a string. MetaMask pops up for the user to confirm. If confirmed and mined, `.then()` runs.

**Step 4 — success:**
Shows "Vote cast successfully!" and reloads the page after 2 seconds (so the updated vote counts are fetched fresh from the blockchain).

**Step 5 — failure:**
`.catch()` shows the error message from the rejected transaction (e.g. "already voted" revert reason) and re-enables the button.

---

### `window.addEventListener("load", ...)`

```js
if (typeof window.ethereum !== "undefined") {
    window.eth = new Web3(window.ethereum);
} else {
    window.eth = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
}
window.App.eventStart();
```
Runs once the page and all scripts have loaded.

- If MetaMask is installed, uses it as the Web3 provider (user signs transactions with their wallet).
- If MetaMask is absent, falls back to a direct HTTP connection to Ganache — useful for read-only testing without a wallet extension, but write operations (voting) won't work.

Calls `App.eventStart()` to kick off everything.
