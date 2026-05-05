const express = require('express');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('./db/seed');

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const { authorizeUser } = require('./middleware/auth');

const app = express();

app.use(express.json());

// Public auth endpoint
app.use(authRouter);

// Admin API
app.use('/admin', adminRouter);

// Static assets
app.get('/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'css', req.params.file));
});

app.get('/assets/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'assets', req.params.file));
});

app.get('/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'js', req.params.file));
});

app.get('/dist/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', req.params.file));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'favicon.ico'));
});

// Protected pages
app.get('/index.html', authorizeUser, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'html', 'index.html'));
});

app.get('/admin.html', authorizeUser, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'html', 'admin.html'));
});

// Login page (root)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'html', 'login.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
