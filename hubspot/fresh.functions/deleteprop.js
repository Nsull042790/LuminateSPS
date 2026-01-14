// Delete Property from HubDB
const https = require('https');

exports.main = async (context, sendResponse) => {
  const { rowId, userEmail } = context.body;

  if (!rowId) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Row ID required' }
    });
  }

  if (!userEmail) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'User email required for authorization' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  try {
    // First, verify the row belongs to this user
    const row = await getRow(token, tableId, rowId);

    if (!row || !row.values) {
      return sendResponse({
        statusCode: 404,
        body: { error: 'Property not found' }
      });
    }

    if (row.values.created_by_email !== userEmail) {
      return sendResponse({
        statusCode: 403,
        body: { error: 'You can only delete your own properties' }
      });
    }

    // Delete the row
    await deleteRow(token, tableId, rowId);

    // Publish to make changes live
    await publishTable(token, tableId);

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        message: 'Property deleted'
      }
    });
  } catch (error) {
    console.error('Delete property error:', error);
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
        try {
          if (res.statusCode === 404) {
            resolve(null);
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function deleteRow(token, tableId, rowId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows/' + rowId + '/draft',
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({ success: true });
        } else {
          reject(new Error('Delete failed: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function publishTable(token, tableId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/draft/publish',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('Publish response:', res.statusCode, data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          reject(new Error('Publish failed: ' + res.statusCode + ' ' + data));
        }
      });
    });
    req.on('error', (err) => {
      console.error('Publish error:', err);
      reject(err);
    });
    req.end();
  });
}
