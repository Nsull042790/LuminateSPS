// Debug endpoint - shows HubDB table schema
const https = require('https');

exports.main = async (context, sendResponse) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  if (!token || !tableId) {
    return sendResponse({
      statusCode: 500,
      body: { error: 'Missing config' }
    });
  }

  try {
    const schema = await getTableSchema(token, tableId);
    const sampleRows = await getSampleRows(token, tableId);

    sendResponse({
      statusCode: 200,
      body: {
        tableId: tableId,
        tableName: schema.name,
        columns: schema.columns.map(c => ({
          name: c.name,
          label: c.label,
          type: c.type,
          isPathColumn: c.name === schema.dynamicMetaTag?.pathColumnId || c.id === schema.dynamicMetaTag?.pathColumnId
        })),
        dynamicMetaTag: schema.dynamicMetaTag,
        sampleRow: sampleRows[0] ? sampleRows[0].values : null
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

function getSampleRows(token, tableId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows?limit=1',
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
