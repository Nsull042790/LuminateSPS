// Create Property in HubDB - v5.0
const https = require('https');

exports.main = async (context, sendResponse) => {
  console.log('createprop v5.0 - Starting property creation');
  const body = context.body;

  if (!body || !body.property || !body.userEmail) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing required fields: property, userEmail' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  if (!token) {
    console.error('ERROR: HUBSPOT_PRIVATE_APP_TOKEN not available');
    return sendResponse({
      statusCode: 500,
      body: { error: 'Server configuration error: missing API token' }
    });
  }

  if (!tableId) {
    console.error('ERROR: HUBDB_TABLE_ID not available');
    return sendResponse({
      statusCode: 500,
      body: { error: 'Server configuration error: missing table ID' }
    });
  }

  console.log('Using tableId:', tableId);

  const prop = body.property;
  const slugVal = (prop.address + '-' + prop.city).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  console.log('Generated slug:', slugVal);

  const rowData = {
    name: prop.address + ', ' + prop.city,
    slug: slugVal,
    address: prop.address,
    city: prop.city,
    state: prop.state || '',
    zip: prop.zip || '',
    price: parseInt(String(prop.price || 0).replace(/[^0-9]/g, '')) || 0,
    bedrooms: parseInt(prop.bedrooms) || 0,
    bathrooms: prop.bathrooms || '',
    sqft: parseInt(String(prop.sqft || 0).replace(/[^0-9]/g, '')) || 0,
    year_built: parseInt(prop.yearBuilt) || 0,
    mls_number: prop.mlsNumber || '',
    description: prop.description || '',
    features: prop.features || '',
    photos: JSON.stringify(body.photos || []),
    realtor_name: body.realtor ? body.realtor.name || '' : '',
    realtor_title: body.realtor ? body.realtor.title || 'Licensed Realtor' : '',
    realtor_company: body.realtor ? body.realtor.company || '' : '',
    realtor_phone: body.realtor ? body.realtor.phone || '' : '',
    realtor_email: body.realtor ? body.realtor.email || '' : '',
    realtor_license: body.realtor ? body.realtor.license || '' : '',
    realtor_photo: body.realtor ? body.realtor.photo || '' : '',
    lo_name: body.loanOfficer ? body.loanOfficer.name || '' : '',
    lo_title: body.loanOfficer ? body.loanOfficer.title || 'Loan Officer' : '',
    lo_company: body.loanOfficer ? body.loanOfficer.company || '' : '',
    lo_phone: body.loanOfficer ? body.loanOfficer.phone || '' : '',
    lo_email: body.loanOfficer ? body.loanOfficer.email || '' : '',
    lo_nmls: body.loanOfficer ? body.loanOfficer.nmls || '' : '',
    lo_photo: body.loanOfficer ? body.loanOfficer.photo || '' : '',
    created_by_email: body.userEmail,
    created_by_name: body.userName || ''
  };

  try {
    // Step 1: Create the row (goes to draft)
    console.log('Step 1: Creating row in draft table...');
    const result = await createRow(token, tableId, rowData);
    console.log('Row created with ID:', result.id);

    // Step 2: Publish the table
    console.log('Step 2: Publishing table...');
    const publishResult = await publishTable(token, tableId);
    console.log('Table published successfully');

    // Step 3: Verify the row exists in published table
    console.log('Step 3: Verifying row in published table...');
    const verified = await verifyPublishedRow(token, tableId, result.id);

    if (!verified) {
      console.error('WARNING: Row created but not found in published table');
      // Still return success since row was created, but flag the issue
      sendResponse({
        statusCode: 200,
        body: {
          success: true,
          rowId: result.id,
          slug: slugVal,
          warning: 'Row created but publish verification pending. Page may take a moment to appear.'
        }
      });
    } else {
      console.log('Row verified in published table - SUCCESS');
      sendResponse({
        statusCode: 200,
        body: {
          success: true,
          rowId: result.id,
          slug: slugVal,
          verified: true
        }
      });
    }
  } catch (error) {
    console.error('Create property error:', error.message);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

function createRow(token, tableId, data) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify({ values: data });
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (r.id) {
            resolve(r);
          } else {
            reject(new Error(r.message || JSON.stringify(r)));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + d));
        }
      });
    });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}

function publishTable(token, tableId) {
  return new Promise((resolve, reject) => {
    console.log('Publishing table:', tableId);
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/draft/publish',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Publish response status:', res.statusCode);
        console.log('Publish response body:', d);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(d);
        } else {
          reject(new Error('Publish failed (HTTP ' + res.statusCode + '): ' + d));
        }
      });
    });
    req.on('error', (e) => {
      console.error('Publish network error:', e.message);
      reject(e);
    });
    req.end();
  });
}

// Verify that a row exists in the PUBLISHED table (not draft)
function verifyPublishedRow(token, tableId, rowId) {
  return new Promise((resolve) => {
    console.log('Verifying row', rowId, 'in published table', tableId);
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows/' + rowId,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Verify response status:', res.statusCode);
        if (res.statusCode === 200) {
          try {
            const row = JSON.parse(d);
            console.log('Row found in published table:', row.id);
            resolve(true);
          } catch (e) {
            console.error('Verify parse error:', e.message);
            resolve(false);
          }
        } else {
          console.log('Row not found in published table, status:', res.statusCode);
          resolve(false);
        }
      });
    });
    req.on('error', (e) => {
      console.error('Verify network error:', e.message);
      resolve(false);
    });
    req.end();
  });
}
