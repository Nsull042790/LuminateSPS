// HubSpot Serverless Function - Create Property in HubDB
const https = require('https');

exports.main = async (context, sendResponse) => {
  const { property, realtor, loanOfficer, photos, neighborhood, showNeighborhood, userEmail, userName } = context.body;

  if (!property || !property.address || !realtor || !realtor.name || !loanOfficer || !loanOfficer.name) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing required fields: property.address, realtor.name, loanOfficer.name' }
    });
  }

  if (!userEmail) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'User email is required for tracking ownership' }
    });
  }

  try {
    const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const tableId = process.env.HUBDB_TABLE_ID;

    // Generate slug from address and city
    const slug = slugify(property.address + '-' + property.city);

    // Prepare row data for HubDB
    const rowData = {
      name: property.address + ', ' + property.city,
      slug: slug,
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      price: property.price || 0,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || '',
      sqft: property.sqft || 0,
      year_built: property.yearBuilt || 0,
      mls_number: property.mlsNumber || '',
      description: property.description || '',
      features: property.features || '',
      photos: JSON.stringify(photos || []),
      realtor_name: realtor.name,
      realtor_title: realtor.title || 'Licensed Realtor',
      realtor_company: realtor.company || '',
      realtor_phone: realtor.phone || '',
      realtor_email: realtor.email || '',
      realtor_license: realtor.license || '',
      realtor_photo: realtor.photo || '',
      lo_name: loanOfficer.name,
      lo_title: loanOfficer.title || 'Loan Officer',
      lo_company: loanOfficer.company || '',
      lo_phone: loanOfficer.phone || '',
      lo_email: loanOfficer.email || '',
      lo_nmls: loanOfficer.nmls || '',
      lo_photo: loanOfficer.photo || '',
      show_neighborhood: showNeighborhood || false,
      walk_score: neighborhood ? neighborhood.walkScore || 0 : 0,
      transit_score: neighborhood ? neighborhood.transitScore || 0 : 0,
      bike_score: neighborhood ? neighborhood.bikeScore || 0 : 0,
      amenities: neighborhood ? neighborhood.amenities || '' : '',
      created_by_email: userEmail,
      created_by_name: userName || ''
    };

    // Create row in HubDB
    const result = await createHubDBRow(accessToken, tableId, rowData);

    // Publish the table to make changes live
    await publishHubDBTable(accessToken, tableId);

    // Build the property URL
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const propertyUrl = `https://${portalId}.hs-sites.com/properties/${slug}`;

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        rowId: result.id,
        url: propertyUrl,
        slug: slug
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

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createHubDBRow(accessToken, tableId, rowData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      values: rowData
    });

    const options = {
      hostname: 'api.hubapi.com',
      path: `/cms/v3/hubdb/tables/${tableId}/rows`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.id) {
            resolve(result);
          } else {
            reject(new Error(result.message || 'Failed to create row'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function publishHubDBTable(accessToken, tableId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path: `/cms/v3/hubdb/tables/${tableId}/draft/publish`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true });
        } else {
          // Non-critical - table may already be published
          resolve({ success: true, note: 'Publish may have already been done' });
        }
      });
    });

    req.on('error', (err) => {
      // Non-critical error
      resolve({ success: true, note: 'Publish request failed but row was created' });
    });
    req.end();
  });
}
