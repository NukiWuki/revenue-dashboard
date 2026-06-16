const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Rate limiting: in-memory store (resets on cold start, good enough for Vercel)
const attempts = {};
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function getRateKey(ip) { return ip; }
function isBlocked(ip) {
  const now = Date.now();
  const entry = attempts[ip];
  if (!entry) return false;
  if (now - entry.firstAt > WINDOW_MS) { delete attempts[ip]; return false; }
  return entry.count >= MAX_ATTEMPTS;
}
function recordAttempt(ip) {
  const now = Date.now();
  if (!attempts[ip] || now - attempts[ip].firstAt > WINDOW_MS) {
    attempts[ip] = { count: 1, firstAt: now };
  } else {
    attempts[ip].count++;
  }
}
function clearAttempts(ip) { delete attempts[ip]; }
function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const ip = getClientIp(req);

  const { action, email, password, token } = req.body || {};

  // === VERIFY TOKEN ===
  if (action === 'verify') {
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) return res.status(401).json({ error: 'Invalid token' });
      const user = await r.json();
      return res.status(200).json({ ok: true, email: user.email });
    } catch(e) {
      return res.status(401).json({ error: 'Token verification failed' });
    }
  }

  // === LOGIN ===
  if (action === 'login') {
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Brute force check
    if (isBlocked(ip)) {
      return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
    }

    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();

      if (!r.ok || data.error) {
        recordAttempt(ip);
        const remaining = MAX_ATTEMPTS - (attempts[ip]?.count || 0);
        return res.status(401).json({
          error: 'Неверный логин или пароль',
          attemptsLeft: Math.max(0, remaining)
        });
      }

      clearAttempts(ip);
      return res.status(200).json({
        ok: true,
        access_token: data.access_token,
        expires_in: data.expires_in,
        email: data.user?.email
      });
    } catch(e) {
      return res.status(500).json({ error: 'Auth service error' });
    }
  }

  res.status(400).json({ error: 'Unknown action' });
};
