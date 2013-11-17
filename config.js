var local;
try {
  local = require('./local')
} catch(e) {
  local = {}
}
module.exports = {
    "CLIENT_ID" : process.env.CLIENT_ID || local.CLIENT_ID,
    "CLIENT_SECRET" : process.env.CLIENT_SECRET || local.CLIENT_SECRET,
    "REDIRECT_URL" : process.env.REDIRECT_URL || local.REDIRECT_URL,
    "MONGO_DB" : process.env.MONGO_DB || local.MONGO_DB
}
