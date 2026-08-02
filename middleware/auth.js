const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  return next();
}

function issueToken(admin) {
  return jwt.sign(
    { id: admin._id, role: admin.role },
    process.env.JWT_SECRET || 'development-jwt-secret',
    { expiresIn: '8h' }
  );
}

module.exports = { requireAdmin, issueToken };
