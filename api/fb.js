const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const FB_TOKEN = process.env.FB_TOKEN;

async function verifyToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    return r.ok;
  } catch { return false; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!await verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'path required' });

  // SSRF whitelist
  const decoded = decodeURIComponent(path);
  if (!decoded.match(/^(act_\d+|me)\//)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    const sep = decoded.includes('?') ? '&' : '?';
    const url = `https://graph.facebook.com/v19.0/${decoded}${sep}access_token=${FB_TOKEN}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
