// Create Property in HubDB - v5.1
// Fixed: Added delay between publish and verification for propagation
const https = require('https');

exports.main = async (context, sendResponse) => {
  console.log('=== createprop v5.1 START ===');
  const body = context.body;

  if (!body || !body.property || !body.userEmail) {
    console.log('ERROR: Missing required fields');
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing required fields: property, userEmail' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  if (!token) {
    console.error('FATAL: HUBSPOT_PRIVATE_APP_TOKEN not available');
    return sendResponse({
      statusCode: 500,
      body: { error: 'Server configuration error: missing API token' }
    });
  }

  if (!tableId) {
    console.error('FATAL: HUBDB_TABLE_ID not available');
    return sendResponse({
      statusCode: 500,
      body: { error: 'Server configuration error: missing table ID' }
    });
  }

  console.log('Config OK - tableId:', tableId, 'token length:', token.length);

  const prop = body.property;

  // Generate slug from address and city
  const slugVal = (prop.address + '-' + prop.city)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

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
    // STEP 1: Create the row (goes to draft)
    console.log('STEP 1: Creating row in HubDB draft...');
    const createResult = await createRow(token, tableId, rowData);
    console.log('Row created - ID:', createResult.id);

    // STEP 2: Publish the table
    console.log('STEP 2: Publishing table...');
    const publishResult = await publishTable(token, tableId);
    console.log('Publish complete - status:', publishResult.status);

    if (!publishResult.success) {
      console.error('PUBLISH FAILED:', publishResult.error);
      return sendResponse({
        statusCode: 500,
        body: {
          error: 'Failed to publish: ' + publishResult.error,
          rowId: createResult.id,
          slug: slugVal,
          published: false
        }
      });
    }

    // STEP 3: Wait for propagation (1.5 seconds)
    console.log('STEP 3: Waiting 1.5s for propagation...');
    await sleep(1500);

    // STEP 4: Verify row exists in published table
    console.log('STEP 4: Verifying row in published table...');
    const verified = await verifyPublishedRow(token, tableId, createResult.id);
    console.log('Verification result:', verified);

    // Return full status
    const response = {
      success: true,
      rowId: createResult.id,
      slug: slugVal,
      published: publishResult.success,
      verified: verified,
      version: '5.1'
    };

    if (!verified) {
      response.warning = 'Row created but verification pending. Page may take up to 60 seconds to appear.';
    }

    console.log('=== createprop v5.1 COMPLETE ===');
    console.log('Response:', JSON.stringify(response));

    sendResponse({
      statusCode: 200,
      body: response
    });

  } catch (error) {
    console.error('=== createprop v5.1 ERROR ===');
    console.error('Error:', error.message);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createRow(token, tableId, data) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify({ values: data });
    console.log('Creating row with', Object.keys(data).length, 'fields');

    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('CreateRow response status:', res.statusCode);
        try {
          const r = JSON.parse(d);
          if (r.id) {
            resolve(r);
          } else {
            console.error('CreateRow failed:', d);
            reject(new Error(r.message || 'Failed to create row: ' + d));
          }
        } catch (e) {
          console.error('CreateRow parse error:', d);
          reject(new Error('Parse error: ' + d.substring(0, 200)));
        }
      });
    });
    req.on('error', (e) => {
      console.error('CreateRow network error:', e.message);
      reject(e);
    });
    req.write(postBody);
    req.end();
  });
}

function publishTable(token, tableId) {
  return new Promise((resolve) => {
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
        console.log('Publish response - status:', res.statusCode, 'body:', d.substring(0, 200));

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode, body: d });
        } else {
          resolve({ success: false, status: res.statusCode, error: d });
        }
      });
    });
    req.on('error', (e) => {
      console.error('Publish network error:', e.message);
      resolve({ success: false, status: 0, error: e.message });
    });
    req.end();
  });
}

function verifyPublishedRow(token, tableId, rowId) {
  return new Promise((resolve) => {
    console.log('Verifying row', rowId, 'exists in published table');

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
        console.log('Verify response - status:', res.statusCode);

        if (res.statusCode === 200) {
          try {
            const row = JSON.parse(d);
            if (row.id) {
              console.log('Row VERIFIED in published table');
              resolve(true);
            } else {
              console.log('Row response missing id');
              resolve(false);
            }
          } catch (e) {
            console.error('Verify parse error');
            resolve(false);
          }
        } else {
          console.log('Row NOT found in published table');
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
