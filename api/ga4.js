const GA4_PROPERTIES = {
  'baitun': '535761776',
  'baitunproject': '446574228'
};

const CLIENT_ID = process.env.GA4_CLIENT_ID;
const CLIENT_SECRET = process.env.GA4_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GA4_REFRESH_TOKEN;

async function getAccessToken() {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { site, startDate, endDate } = req.query;
    const propertyId = GA4_PROPERTIES[site] || GA4_PROPERTIES['baitun'];
    const token = await getAccessToken();

    const body = {
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' }
      ],
      limit: 1000
    };

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
