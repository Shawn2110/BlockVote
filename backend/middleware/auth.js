const jwt = require('jsonwebtoken');

function getToken(req) {
  let token = req.query.Authorization && req.query.Authorization.split('Bearer ')[1];
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split('Bearer ')[1];
  }
  return token;
}

function verifyToken(token) {
  return jwt.verify(token, process.env.SECRET_KEY, { algorithms: ['HS256'] });
}

// For protected page loads (returns HTML on failure).
const authorizeUser = (req, res, next) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).send('<h1 align="center"> Login to Continue </h1>');
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid authorization token' });
  }
};

// For API requests (returns JSON on failure).
const authorizeApi = (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

module.exports = authorizeUser;
module.exports.authorizeUser = authorizeUser;
module.exports.authorizeApi = authorizeApi;
module.exports.requireAdmin = requireAdmin;
