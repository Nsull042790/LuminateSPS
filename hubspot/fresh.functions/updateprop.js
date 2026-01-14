// Update Property in HubDB - v5.4
// Updates an existing property row (only by original creator)
const https = require('https');

exports.main = async (context, sendResponse) => {
  console.log('=== updateprop v5.4 START ===');
  const body = context.body;

  if (!body || !body.rowId || !body.property || !body.userEmail) {
    console.log('ERROR: Missing required fields');
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing required fields: rowId, property, userEmail' }
    });
  }

  // Server-side validation
  const MAX_DESCRIPTION_LENGTH = 5000;
  const MAX_PHOTOS = 20;

  if (body.property.description && body.property.description.length > MAX_DESCRIPTION_LENGTH) {
    console.log('ERROR: Description too long:', body.property.description.length);
    return sendResponse({
      statusCode: 400,
      body: { error: 'Description exceeds maximum length of ' + MAX_DESCRIPTION_LENGTH + ' characters' }
    });
  }

  if (body.photos && body.photos.length > MAX_PHOTOS) {
    console.log('ERROR: Too many photos:', body.photos.length);
    return sendResponse({
      statusCode: 400,
      body: { error: 'Maximum ' + MAX_PHOTOS + ' photos allowed' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;

  if (!token || !tableId) {
    console.error('FATAL: Missing configuration');
    return sendResponse({
      statusCode: 500,
      body: { error: 'Server configuration error' }
    });
  }

  const rowId = body.rowId;

  try {
    // STEP 1: Verify ownership - get existing row and check created_by_email
    console.log('STEP 1: Verifying ownership of row', rowId);
    const existingRow = await getRow(token, tableId, rowId);

    if (!existingRow) {
      return sendResponse({
        statusCode: 404,
        body: { error: 'Property not found' }
      });
    }

    const ownerEmail = existingRow.values.created_by_email || '';
    if (ownerEmail.toLowerCase() !== body.userEmail.toLowerCase()) {
      console.log('AUTH FAILED: User', body.userEmail, 'tried to edit property owned by', ownerEmail);
      return sendResponse({
        statusCode: 403,
        body: { error: 'You can only edit properties you created' }
      });
    }

    console.log('Ownership verified for:', body.userEmail);

    const prop = body.property;

    const rowData = {
      name: prop.address + (prop.address_2 ? ' ' + prop.address_2 : '') + ', ' + prop.city,
      slug: existingRow.values.slug, // Keep original slug
      address: prop.address,
      address_2: prop.address_2 || '',
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
      realtor_website: body.realtor ? body.realtor.website || '' : '',
      realtor_logo: body.realtor ? body.realtor.logo || '' : '',
      lo_name: body.loanOfficer ? body.loanOfficer.name || '' : '',
      lo_title: body.loanOfficer ? body.loanOfficer.title || 'Loan Officer' : '',
      lo_company: body.loanOfficer ? body.loanOfficer.company || '' : '',
      lo_phone: body.loanOfficer ? body.loanOfficer.phone || '' : '',
      lo_email: body.loanOfficer ? body.loanOfficer.email || '' : '',
      lo_nmls: body.loanOfficer ? body.loanOfficer.nmls || '' : '',
      lo_photo: body.loanOfficer ? body.loanOfficer.photo || '' : '',
      lo_website: body.loanOfficer ? body.loanOfficer.website || '' : '',
      show_neighborhood: body.showNeighborhood ? true : false,
      walk_score: body.neighborhood ? parseInt(body.neighborhood.walkScore) || 0 : 0,
      transit_score: body.neighborhood ? parseInt(body.neighborhood.transitScore) || 0 : 0,
      bike_score: body.neighborhood ? parseInt(body.neighborhood.bikeScore) || 0 : 0,
      amenities: body.neighborhood ? body.neighborhood.amenities || '' : '',
      // Preserve original creator info
      created_by_email: existingRow.values.created_by_email,
      created_by_name: existingRow.values.created_by_name || ''
    };

    // STEP 2: Update the row
    console.log('STEP 2: Updating row in HubDB draft...');
    const updateResult = await updateRow(token, tableId, rowId, rowData);
    console.log('Row updated - ID:', updateResult.id);

    // STEP 3: Publish the table
    console.log('STEP 3: Publishing table...');
    const publishResult = await publishTable(token, tableId);
    console.log('Publish complete - status:', publishResult.status);

    if (!publishResult.success) {
      console.error('PUBLISH FAILED:', publishResult.error);
      return sendResponse({
        statusCode: 500,
        body: {
          error: 'Failed to publish: ' + publishResult.error,
          rowId: rowId,
          published: false
        }
      });
    }

    // STEP 4: Wait for propagation
    console.log('STEP 4: Waiting for propagation...');
    await sleep(1000);

    const response = {
      success: true,
      rowId: rowId,
      slug: existingRow.values.slug,
      published: true,
      version: '5.4'
    };

    console.log('=== updateprop v5.4 COMPLETE ===');
    sendResponse({
      statusCode: 200,
      body: response
    });

  } catch (error) {
    console.error('=== updateprop v5.4 ERROR ===');
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
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(d));
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

function updateRow(token, tableId, rowId, data) {
  return new Promise((resolve, reject) => {
    // Don't include path - HubDB preserves the existing path for the same row
    const requestBody = { values: data };
    const postBody = JSON.stringify(requestBody);
    console.log('Updating row', rowId, 'with', Object.keys(data).length, 'fields');

    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/rows/' + rowId + '/draft',
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('UpdateRow response status:', res.statusCode);
        try {
          const r = JSON.parse(d);
          if (r.id) {
            resolve(r);
          } else {
            console.error('UpdateRow failed:', d);
            reject(new Error(r.message || 'Failed to update row'));
          }
        } catch (e) {
          console.error('UpdateRow parse error:', d);
          reject(new Error('Parse error'));
        }
      });
    });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}

function publishTable(token, tableId) {
  return new Promise((resolve) => {
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode });
        } else {
          resolve({ success: false, status: res.statusCode, error: d });
        }
      });
    });
    req.on('error', (e) => {
      resolve({ success: false, status: 0, error: e.message });
    });
    req.end();
  });
}
