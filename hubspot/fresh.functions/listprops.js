// List Properties from HubDB
const https = require('https');

exports.main = async (context, sendResponse) => {
  const email = context.params.email ? context.params.email[0] : null;

  if (!email) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Email parameter required' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  try {
    const rows = await getRows(token, tableId, email);
    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        properties: rows
      }
    });
  } catch (error) {
    console.error('List properties error:', error);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

function getRows(token, tableId, email) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // Filter rows by created_by_email
          const filtered = (result.results || []).filter(r =>
            r.values && r.values.created_by_email === email
          );
          resolve(filtered);
        } catch (e) {
          reject(new Error('Parse error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
