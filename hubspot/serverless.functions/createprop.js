// Create Property in HubDB
const https = require('https');

exports.main = async (context, sendResponse) => {
  const body = context.body;

  if (!body || !body.property || !body.userEmail) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing required fields: property, userEmail' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID;
  const prop = body.property;
  const slugVal = (prop.address + '-' + prop.city).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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
    const result = await createRow(token, tableId, rowData);
    await publishTable(token, tableId);
    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        rowId: result.id,
        slug: slugVal
      }
    });
  } catch (error) {
    console.error('Create property error:', error);
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
    const req = https.request({
      hostname: 'api.hubapi.com',
      path: '/cms/v3/hubdb/tables/' + tableId + '/draft/publish',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Publish response:', res.statusCode, d);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error('Publish failed: ' + d));
        }
      });
    });
    req.on('error', (e) => {
      console.error('Publish error:', e);
      reject(e);
    });
    req.end();
  });
}
