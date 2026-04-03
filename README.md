# BlockVote - Decentralized Voting System

A secure and transparent voting system built on the Ethereum blockchain. BlockVote ensures tamper-proof voting records, enabling users to cast votes remotely while maintaining anonymity and preventing fraud through smart contracts.

## Features

- **Blockchain-Powered Voting** — Votes are recorded on the Ethereum blockchain, making them immutable and transparent
- **JWT Authentication** — Secure voter authentication and role-based authorization (admin/voter)
- **Admin Dashboard** — Manage candidates, set voting periods, and monitor live results
- **Live Vote Tracking** — Real-time progress bars showing vote distribution across candidates
- **One-Vote-Per-Address** — Smart contract enforces single vote per Ethereum address
- **Modern Dark UI** — Glassmorphism design with animated elements and responsive layout
- **Multi-User Support** — 10 pre-configured voter accounts and 1 admin account for demo

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity (v0.5.16) |
| Blockchain | Ethereum (Ganache local) |
| Frontend | HTML5, CSS3, JavaScript, jQuery |
| Backend | Node.js + Express (port 8080) |
| API | Python FastAPI (port 8000) |
| Database | MySQL |
| Auth | JSON Web Tokens (JWT) |
| Wallet | MetaMask |
| Build | Truffle, Browserify |

## Prerequisites

- Node.js (v18+)
- Python (v3.9+)
- MySQL Server
- MetaMask browser extension
- Truffle (`npm install -g truffle`)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shawn2110/BlockVote.git
   cd BlockVote
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install fastapi mysql-connector-python pydantic python-dotenv uvicorn uvicorn[standard] PyJWT
   ```

4. **Set up MySQL database**
   ```sql
   CREATE DATABASE voter_db;
   USE voter_db;

   CREATE TABLE voters (
     voter_id VARCHAR(36) PRIMARY KEY NOT NULL,
     role ENUM('admin', 'user') NOT NULL,
     password VARCHAR(255) NOT NULL
   );

   INSERT INTO voters (voter_id, role, password) VALUES
     ('admin-001', 'admin', 'admin123'),
     ('voter-001', 'user', 'alice2024'),
     ('voter-002', 'user', 'bob2024'),
     ('voter-003', 'user', 'carol2024'),
     ('voter-004', 'user', 'dave2024'),
     ('voter-005', 'user', 'emma2024'),
     ('voter-006', 'user', 'frank2024'),
     ('voter-007', 'user', 'grace2024'),
     ('voter-008', 'user', 'henry2024'),
     ('voter-009', 'user', 'iris2024'),
     ('voter-010', 'user', 'jake2024');
   ```

5. **Configure database credentials**

   Create `Database_API/.env`:
   ```
   MYSQL_USER="root"
   MYSQL_PASSWORD="your_password"
   MYSQL_HOST="localhost"
   MYSQL_DB="voter_db"
   SECRET_KEY="your_secret_key_here"
   ```

6. **Set up MetaMask**
   - Install the [MetaMask](https://metamask.io/download/) browser extension
   - Add a custom network:

     | Field | Value |
     |-------|-------|
     | Network Name | Localhost 7545 |
     | RPC URL | http://127.0.0.1:7545 |
     | Chain ID | 1337 |
     | Currency | ETH |

## Usage

1. **Start Ganache** (local blockchain)
   ```bash
   npx ganache --port 7545 --networkId 1337 --deterministic
   ```

2. **Compile and migrate smart contracts**
   ```bash
   truffle compile
   truffle migrate
   ```

3. **Bundle JavaScript**
   ```bash
   npx browserify ./src/js/app.js -o ./src/dist/app.bundle.js
   npx browserify ./src/js/login.js -o ./src/dist/login.bundle.js
   ```

4. **Start the Node.js server**
   ```bash
   node index.js
   ```

5. **Start the API server** (in a new terminal)
   ```bash
   cd Database_API
   uvicorn main:app --reload --host 127.0.0.1
   ```

6. **Open the app** at http://localhost:8080

## Demo Accounts

| Voter ID | Role | Password |
|----------|------|----------|
| admin-001 | Admin | admin123 |
| voter-001 | Voter | alice2024 |
| voter-002 | Voter | bob2024 |
| voter-003 | Voter | carol2024 |
| voter-004 | Voter | dave2024 |
| voter-005 | Voter | emma2024 |
| voter-006 | Voter | frank2024 |
| voter-007 | Voter | grace2024 |
| voter-008 | Voter | henry2024 |
| voter-009 | Voter | iris2024 |
| voter-010 | Voter | jake2024 |

## How It Works

1. **Admin Setup** — Log in as admin to add candidates and set voting dates
2. **Voter Login** — Voters authenticate with their ID and password via the FastAPI backend
3. **Cast Vote** — Select a candidate and submit; MetaMask signs the transaction
4. **Blockchain Record** — The smart contract validates the vote (correct time window, valid candidate, no double voting) and records it permanently
5. **Live Results** — Vote counts and progress bars update in real-time

## Project Structure

```
BlockVote/
├── contracts/              # Solidity smart contracts
│   ├── Voting.sol          # Main voting contract
│   └── Migrations.sol      # Truffle migration contract
├── Database_API/           # Python FastAPI backend
│   └── main.py             # Authentication API
├── migrations/             # Truffle deployment scripts
│   └── 1_initial_migration.js
├── src/
│   ├── css/                # Stylesheets (dark theme)
│   ├── html/               # HTML pages (login, voter, admin)
│   ├── js/                 # Frontend JavaScript
│   └── dist/               # Bundled JS (generated)
├── index.js                # Express server
├── truffle-config.js       # Truffle configuration
└── package.json            # Node.js dependencies
```

## Smart Contract

The `Voting.sol` contract handles:
- **addCandidate()** — Register a new candidate (admin)
- **vote()** — Cast a vote with validation (time window, single vote, valid candidate)
- **setDates()** — Define the voting period (one-time, admin)
- **getCandidate()** — Retrieve candidate details and vote count
- **checkVote()** — Check if the current address has already voted

## License

This project is licensed under the [MIT License](LICENSE).
