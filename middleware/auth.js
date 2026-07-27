const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  return res.redirect('/dashboard/login');
}

function issueToken(admin) {
  return jwt.sign(
    { id: admin._id, role: admin.role },
    process.env.JWT_SECRET || 'development-jwt-secret',
    { expiresIn: '8h' }
  );
}

module.exports = { requireAdmin, issueToken };
