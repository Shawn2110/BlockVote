const db = require('./database');

// Default admin uses Ganache deterministic account 0 (the contract deployer).
// Replace with your real deployer address if running on a different network.
const ADMIN_ETH_ADDRESS = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

const insert = db.prepare(
  'INSERT OR IGNORE INTO voters (voter_id, password, role, eth_address) VALUES (?, ?, ?, ?)'
);

insert.run('admin', 'admin123', 'admin', ADMIN_ETH_ADDRESS);
console.log('Database seeded with admin only. Add voters via the admin panel.');
