// List Properties from HubDB - with server-side filtering
const https = require('https');

exports.main = async (context, sendResponse) => {
  const email = context.params.email ? context.params.email[0] : null;
  const limit = context.params.limit ? parseInt(context.params.limit[0]) : 100;
  const offset = context.params.offset ? context.params.offset[0] : null;

  if (!email) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Email parameter required' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  try {
    const result = await getRows(token, tableId, email, limit, offset);
    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        properties: result.rows,
        paging: result.paging
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

function getRows(token, tableId, email, limit, offset) {
  return new Promise((resolve, reject) => {
    // Use HubDB filtering to query by created_by_email on the server
    // This is much more efficient than fetching all rows
    const encodedEmail = encodeURIComponent(email);
    let path = '/cms/v3/hubdb/tables/' + tableId + '/rows?created_by_email__eq=' + encodedEmail + '&limit=' + limit + '&sort=-hs_created_at';

    if (offset) {
      path += '&after=' + offset;
    }

    const req = https.request({
      hostname: 'api.hubapi.com',
      path: path,
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
          resolve({
            rows: result.results || [],
            paging: result.paging || null
          });
        } catch (e) {
          reject(new Error('Parse error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
