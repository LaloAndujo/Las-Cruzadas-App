function wantsJSON(req) {
  const a = (req.headers['accept'] || '').toLowerCase();
  const ct = (req.headers['content-type'] || '').toLowerCase();
  return a.includes('application/json') || ct.includes('application/json') || req.xhr === true || 'json' in req.query;
}
module.exports = { wantsJSON };
