const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

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

async function query(table, params = '') {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + (params ? '?' + params : ''), {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Accept': 'application/json' }
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Supabase error: ' + JSON.stringify(data));
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Auth check
  if (!await verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { type, year, source, manager, limit = 10000 } = req.query;

    if (type === 'leads') {
      let params = 'order=date_create.desc&limit=' + limit;
      if (year) params += '&date_create=gte.' + year + '-01-01T00:00:00Z&date_create=lt.' + (parseInt(year)+1) + '-01-01T00:00:00Z';
      if (source) params += '&source_id=eq.' + encodeURIComponent(source);
      if (manager) params += '&assigned_by_id=eq.' + encodeURIComponent(manager);
      const data = await query('leads', params);
      return res.status(200).json(Array.isArray(data) ? data : []);
    }
    if (type === 'deals') {
      let params = 'order=date_create.desc&limit=' + limit;
      if (year) params += '&date_create=gte.' + year + '-01-01T00:00:00Z&date_create=lt.' + (parseInt(year)+1) + '-01-01T00:00:00Z';
      if (manager) params += '&assigned_by_id=eq.' + encodeURIComponent(manager);
      const data = await query('deals', params);
      return res.status(200).json(Array.isArray(data) ? data : []);
    }
    if (type === 'users') {
      const data = await query('users', 'order=name.asc&limit=200&active=eq.true');
      return res.status(200).json(Array.isArray(data) ? data : []);
    }
    if (type === 'sync_status') {
      const data = await query('sync_log', 'order=synced_at.desc&limit=1');
      return res.status(200).json(Array.isArray(data) ? data : []);
    }
    res.status(400).json({ error: 'Unknown type' });
  } catch(e) {
    console.error('Data API error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
