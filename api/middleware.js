const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verifyToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
    });
    return r.ok;
  } catch { return false; }
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

module.exports = { verifyToken, securityHeaders };
