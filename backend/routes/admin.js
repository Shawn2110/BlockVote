const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authorizeApi, requireAdmin } = require('../middleware/auth');

router.use(authorizeApi);
router.use(requireAdmin);

// List all voters (admin first, then voters by id)
router.get('/voters', (req, res) => {
  const voters = db
    .prepare('SELECT voter_id, eth_address, role FROM voters ORDER BY role DESC, voter_id ASC')
    .all();
  res.json(voters);
});

// Create a new voter
router.post('/voter', (req, res) => {
  const { voter_id, password, eth_address } = req.body || {};

  if (!voter_id || !password || !eth_address) {
    return res.status(400).json({ message: 'voter_id, password and eth_address are required' });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(eth_address)) {
    return res.status(400).json({ message: 'Invalid Ethereum address' });
  }

  try {
    db.prepare(
      'INSERT INTO voters (voter_id, password, role, eth_address) VALUES (?, ?, ?, ?)'
    ).run(voter_id, password, 'user', eth_address);
    return res.status(201).json({ voter_id, eth_address, role: 'user' });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ message: 'Voter ID already exists' });
    }
    return res.status(500).json({ message: e.message });
  }
});

// Delete a voter (admin cannot delete themselves)
router.delete('/voter/:voter_id', (req, res) => {
  if (req.params.voter_id === 'admin') {
    return res.status(400).json({ message: 'Cannot delete admin' });
  }
  db.prepare('DELETE FROM voters WHERE voter_id = ?').run(req.params.voter_id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
