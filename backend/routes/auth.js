const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');

router.get('/login', (req, res) => {
  const { voter_id, password } = req.query;

  if (!voter_id || !password) {
    return res.status(400).json({ message: 'voter_id and password are required' });
  }

  const voter = db
    .prepare('SELECT role, eth_address FROM voters WHERE voter_id = ? AND password = ?')
    .get(voter_id, password);

  if (!voter) {
    return res.status(401).json({ message: 'Invalid Voter ID or password' });
  }

  const token = jwt.sign(
    { voter_id, role: voter.role, eth_address: voter.eth_address },
    process.env.SECRET_KEY,
    { algorithm: 'HS256' }
  );

  return res.json({
    token,
    role: voter.role,
    eth_address: voter.eth_address,
  });
});

module.exports = router;
