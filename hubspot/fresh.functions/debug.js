// Debug endpoint - shows HubDB table schema and specific row
const https = require('https');

exports.main = async (context, sendResponse) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;
  const rowId = context.params.rowId ? context.params.rowId[0] : null;

  if (!token || !tableId) {
    return sendResponse({
      statusCode: 500,
      body: { error: 'Missing config' }
    });
  }

  try {
    const schema = await getTableSchema(token, tableId);

    // If rowId provided, get that specific row
    let specificRow = null;
    if (rowId) {
      specificRow = await getRowById(token, tableId, rowId);
    }

    // Get recent rows to see slugs
    const recentRows = await getRecentRows(token, tableId);

    sendResponse({
      statusCode: 200,
      body: {
        tableId: tableId,
        tableName: schema.name,
        dynamicMetaTag: schema.dynamicMetaTag || 'NOT SET',
        specificRow: specificRow,
        recentRows: recentRows.map(r => ({
          id: r.id,
          name: r.values.name,
          slug: r.values.slug,
          address: r.values.address,
          city: r.values.city
        }))
      }
    });
  } catch (error) {
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

function getTableSchema(token, tableId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          reject(new Error('Parse error: ' + d));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getRowById(token, tableId, rowId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows/' + rowId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          reject(new Error('Parse error: ' + d));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getRecentRows(token, tableId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows?limit=5&sort=-hs_created_at',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(d);
          resolve(result.results || []);
        } catch (e) {
          reject(new Error('Parse error: ' + d));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
