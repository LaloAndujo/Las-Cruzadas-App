function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect('/login.html');
}
function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  if (req.accepts('html')) return res.redirect('/login.html');
  return res.status(401).json({ error: 'No autorizado' });
}
module.exports = { isAuthenticated, requireAuth };
