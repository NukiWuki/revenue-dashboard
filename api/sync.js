const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const EDGE_URL = `${SUPABASE_URL}/functions/v1/sync-bitrix`;

async function verifyToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    return r.ok;
  } catch { return false; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const cronSecret = process.env.CRON_SECRET || 'baitun-cron-2024';
  if (req.query.secret !== cronSecret && !await verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type || 'all';

  try {
    // Вызываем Edge Function — у неё нет таймаута 60 сек
    const r = await fetch(`${EDGE_URL}?secret=baitun2024&type=${type}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Edge function error: ' + text.slice(0, 200) }); }

    return res.status(r.ok ? 200 : 500).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
