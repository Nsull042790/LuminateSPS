// Get single property from HubDB - v5.2
const https = require('https');

exports.main = async (context, sendResponse) => {
  const rowId = context.params.id ? context.params.id[0] : null;
  const email = context.params.email ? context.params.email[0] : null;

  if (!rowId) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Property ID required' }
    });
  }

  if (!email) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Email parameter required' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  try {
    const row = await getRow(token, tableId, rowId);

    if (!row) {
      return sendResponse({
        statusCode: 404,
        body: { error: 'Property not found' }
      });
    }

    // Verify ownership
    const ownerEmail = row.values.created_by_email || '';
    if (ownerEmail.toLowerCase() !== email.toLowerCase()) {
      return sendResponse({
        statusCode: 403,
        body: { error: 'You can only view properties you created' }
      });
    }

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        property: row
      }
    });
  } catch (error) {
    console.error('Get property error:', error);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

function getRow(token, tableId, rowId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows/' + rowId,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Parse error'));
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error('Failed to get row: ' + res.statusCode));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
