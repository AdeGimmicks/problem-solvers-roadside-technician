const mongoose = require('mongoose');

function hasDatabase() {
  return Boolean(process.env.MONGODB_URI && mongoose.connection.readyState === 1);
}

module.exports = { hasDatabase };
