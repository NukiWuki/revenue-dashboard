const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TIKTOK_TOKEN = process.env.TIKTOK_TOKEN;
const TIKTOK_ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;

async function verifyToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
    });
    return r.ok;
  } catch { return false; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!await verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TikTok Ads API pending approval — return placeholder
  if (!TIKTOK_TOKEN || !TIKTOK_ADVERTISER_ID) {
    return res.status(200).json({ pending: true, message: 'TikTok Ads API approval pending' });
  }

  try {
    const { startDate, endDate } = req.query;
    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${TIKTOK_ADVERTISER_ID}&report_type=BASIC&dimensions=["campaign_id","stat_time_day"]&metrics=["spend","impressions","clicks","ctr"]&start_date=${startDate}&end_date=${endDate}&page_size=100`;
    const r = await fetch(url, { headers: { 'Access-Token': TIKTOK_TOKEN } });
    const data = await r.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
