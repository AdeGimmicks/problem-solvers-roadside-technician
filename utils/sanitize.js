const xss = require('xss');

function clean(value) {
  if (typeof value !== 'string') return value;
  return xss(value.trim());
}

function cleanObject(input) {
  return Object.fromEntries(
    Object.entries(input || {}).map(([key, value]) => [key, clean(value)])
  );
}

module.exports = { clean, cleanObject };
