const db = require('./database');

const voters = [
  { voter_id: 'admin',   password: 'admin123', role: 'admin' },
  { voter_id: 'voter1',  password: 'pass1',    role: 'user'  },
  { voter_id: 'voter2',  password: 'pass2',    role: 'user'  },
  { voter_id: 'voter3',  password: 'pass3',    role: 'user'  },
  { voter_id: 'voter4',  password: 'pass4',    role: 'user'  },
  { voter_id: 'voter5',  password: 'pass5',    role: 'user'  },
  { voter_id: 'voter6',  password: 'pass6',    role: 'user'  },
  { voter_id: 'voter7',  password: 'pass7',    role: 'user'  },
  { voter_id: 'voter8',  password: 'pass8',    role: 'user'  },
  { voter_id: 'voter9',  password: 'pass9',    role: 'user'  },
  { voter_id: 'voter10', password: 'pass10',   role: 'user'  },
];

const insert = db.prepare(
  'INSERT OR IGNORE INTO voters (voter_id, password, role) VALUES (?, ?, ?)'
);

const seedAll = db.transaction(() => {
  for (const v of voters) {
    insert.run(v.voter_id, v.password, v.role);
  }
});

seedAll();
console.log('Database seeded with 1 admin and 10 voters.');
