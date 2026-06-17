const SUPABASE_URL = 'https://fjvqqnrmqdnlfjnxhfzr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const BITRIX = process.env.BITRIX_WEBHOOK || 'https://baitun.bitrix24.kz/rest/4079/anrsfsoo1hhcs3x3';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sbUpsert(table, rows) {
  if (!rows || rows.length === 0) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase ${table} upsert error: ${err}`);
  }
}

// Bitrix с автоматическим retry при 429
async function bxPage(method, fields, filters, order, start, retries = 3) {
  const url = new URL(`${BITRIX}/${method}.json`);
  fields.forEach(f => url.searchParams.append('select[]', f));
  Object.entries(filters).forEach(([k, v]) => url.searchParams.append(k, v));
  Object.entries(order).forEach(([k, v]) => url.searchParams.append(`order[${k}]`, v));
  url.searchParams.append('limit', '50');
  url.searchParams.append('start', String(start));

  for (let attempt = 0; attempt < retries; attempt++) {
    const r = await fetch(url.toString());
    if (r.status === 429) {
      const wait = (attempt + 1) * 2000; // 2s, 4s, 6s
      console.log(`Bitrix 429 on ${method}, waiting ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!r.ok) throw new Error(`Bitrix HTTP ${r.status} on ${method}`);
    return await r.json();
  }
  throw new Error(`Bitrix ${method} blocked after ${retries} retries (rate limit)`);
}

async function bxList(method, fields, filters = {}, order = {}) {
  let allItems = [], start = 0;
  while (true) {
    const data = await bxPage(method, fields, filters, order, start);
    if (!data.result || data.result.length === 0) break;
    allItems = allItems.concat(data.result.filter(i => i.ID));
    if (!data.next || allItems.length >= 15000) break;
    start = data.next;
    await sleep(600); // ~1.6 req/sec — ниже лимита Bitrix в 2 req/sec
  }
  return allItems;
}

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
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const cronSecret = process.env.CRON_SECRET || 'baitun-cron-2024';
  if (req.query.secret !== cronSecret && !await verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type || 'all';
  const results = {};

  try {
    // ===== USERS =====
    if (type === 'all' || type === 'users') {
      const deptIds = ['255', '67', '243'];
      const seen = new Set();
      const upsertUsers = [];
      for (const deptId of deptIds) {
        const users = await bxList('user.get', ['ID','NAME','LAST_NAME','ACTIVE','EMAIL'], { UF_DEPARTMENT: deptId });
        for (const u of users) {
          if (seen.has(u.ID)) continue;
          seen.add(u.ID);
          upsertUsers.push({ id: String(u.ID), name: u.NAME||'', last_name: u.LAST_NAME||'', active: u.ACTIVE!=='N', updated_at: new Date().toISOString() });
        }
        await sleep(1000);
      }
      await sbUpsert('users', upsertUsers);
      results.users = upsertUsers.length;
      console.log(`Users synced: ${upsertUsers.length}`);
    }

    // ===== LEADS =====
    if (type === 'all' || type === 'leads') {
      const rawLeads = await bxList('crm.lead.list',
        ['ID','TITLE','STATUS_ID','SOURCE_ID','DATE_CREATE','ASSIGNED_BY_ID',
         'NAME','LAST_NAME','OPPORTUNITY','CURRENCY_ID',
         'UTM_SOURCE','UTM_MEDIUM','UTM_CAMPAIGN','UTM_CONTENT','CONTACT_ID','COMPANY_ID'],
        {}, { DATE_CREATE: 'DESC' }
      );

      for (let i = 0; i < rawLeads.length; i += 500) {
        const batch = rawLeads.slice(i, i+500).map(l => ({
          id: String(l.ID), title: l.TITLE||'', status_id: l.STATUS_ID||'',
          source_id: l.SOURCE_ID||'', utm_source: l.UTM_SOURCE||null,
          utm_medium: l.UTM_MEDIUM||null, utm_campaign: l.UTM_CAMPAIGN||null,
          utm_content: l.UTM_CONTENT||null,
          assigned_by_id: l.ASSIGNED_BY_ID ? String(l.ASSIGNED_BY_ID) : null,
          name: l.NAME||'', last_name: l.LAST_NAME||'',
          opportunity: parseFloat(l.OPPORTUNITY||'0')||0,
          currency_id: l.CURRENCY_ID||'KZT', date_create: l.DATE_CREATE||null,
          contact_id: l.CONTACT_ID ? String(l.CONTACT_ID) : null,
          company_id: l.COMPANY_ID ? String(l.COMPANY_ID) : null
        }));
        await sbUpsert('leads', batch);
      }
      results.leads = rawLeads.length;
      console.log(`Leads synced: ${rawLeads.length}`);
    }

    // ===== DEALS =====
    if (type === 'all' || type === 'deals') {
      const categoryIds = ['31','41','3','9'];
      let allDeals = [];
      for (const catId of categoryIds) {
        const deals = await bxList('crm.deal.list',
          ['ID','TITLE','STAGE_ID','CATEGORY_ID','SOURCE_ID','DATE_CREATE','CLOSEDATE',
           'ASSIGNED_BY_ID','OPPORTUNITY','CURRENCY_ID',
           'UTM_SOURCE','UTM_MEDIUM','UTM_CAMPAIGN','UTM_CONTENT','CONTACT_ID','COMPANY_ID',
           'UF_CRM_1629193916','UF_CRM_1664348197','UF_CRM_1664348185',
           'UF_CRM_1664348549','UF_CRM_6660371C64E62','UF_CRM_1748253788','UF_CRM_CHERTEZHNIK'],
          { 'filter[CATEGORY_ID]': catId }, { DATE_CREATE: 'DESC' }
        );
        allDeals = allDeals.concat(deals);
        console.log(`Category ${catId}: ${deals.length} deals`);
        await sleep(1000);
      }

      for (let i = 0; i < allDeals.length; i += 500) {
        const batch = allDeals.slice(i, i+500).map(d => ({
          id: String(d.ID), title: d.TITLE||'', stage_id: d.STAGE_ID||'',
          category_id: d.CATEGORY_ID ? String(d.CATEGORY_ID) : null,
          source_id: d.SOURCE_ID||'', utm_source: d.UTM_SOURCE||null,
          utm_medium: d.UTM_MEDIUM||null, utm_campaign: d.UTM_CAMPAIGN||null,
          utm_content: d.UTM_CONTENT||null,
          assigned_by_id: d.ASSIGNED_BY_ID ? String(d.ASSIGNED_BY_ID) : null,
          opportunity: parseFloat(d.OPPORTUNITY||'0')||0,
          currency_id: d.CURRENCY_ID||'KZT', date_create: d.DATE_CREATE||null,
          closedate: d.CLOSEDATE||null,
          contact_id: d.CONTACT_ID ? String(d.CONTACT_ID) : null,
          company_id: d.COMPANY_ID ? String(d.COMPANY_ID) : null,
          gap_id: d.UF_CRM_1629193916 ? String(d.UF_CRM_1629193916) : null,
          visualizer_id: d.UF_CRM_1664348197 ? String(d.UF_CRM_1664348197) : null,
          technik_id: d.UF_CRM_1664348185 ? String(d.UF_CRM_1664348185) : null,
          kompozitor_id: d.UF_CRM_1664348549 ? String(d.UF_CRM_1664348549) : null,
          gip_id: d.UF_CRM_6660371C64E62 ? String(d.UF_CRM_6660371C64E62) : null,
          gl_designer_id: d.UF_CRM_1748253788 ? String(d.UF_CRM_1748253788) : null,
          cherteznik_id: d.UF_CRM_CHERTEZHNIK ? String(d.UF_CRM_CHERTEZHNIK) : null
        }));
        await sbUpsert('deals', batch);
      }
      results.deals = allDeals.length;
      console.log(`Deals synced: ${allDeals.length}`);
    }

    // Лог
    await fetch(`${SUPABASE_URL}/rest/v1/sync_log`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'vercel-sync', records_synced: (results.leads||0)+(results.deals||0)+(results.users||0), synced_at: new Date().toISOString() })
    });

    res.status(200).json({ success: true, ...results, synced_at: new Date().toISOString() });
  } catch(e) {
    console.error('Sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
