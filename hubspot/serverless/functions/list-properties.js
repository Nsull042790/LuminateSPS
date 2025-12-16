// HubSpot Serverless Function - List Properties from HubDB
const https = require('https');

exports.main = async (context, sendResponse) => {
  try {
    const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const tableId = process.env.HUBDB_TABLE_ID;
    const portalId = process.env.HUBSPOT_PORTAL_ID;

    // Get user email from query params for filtering
    const userEmail = context.params ? context.params.email : null;
    const showAll = context.params ? context.params.showAll === 'true' : false;

    // Get all rows from HubDB (we'll filter client-side or via query)
    const rows = await getHubDBRows(accessToken, tableId, userEmail, showAll);

    // Map rows to property objects
    const properties = rows.map(row => ({
      id: row.id,
      name: row.values.name,
      slug: row.values.slug,
      address: row.values.address,
      city: row.values.city,
      state: row.values.state,
      price: row.values.price,
      url: `https://${portalId}.hs-sites.com/properties/${row.values.slug}`,
      createdAt: row.createdAt,
      createdBy: row.values.created_by_email,
      createdByName: row.values.created_by_name
    }));

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        properties: properties,
        total: properties.length
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

function getHubDBRows(accessToken, tableId, userEmail, showAll) {
  return new Promise((resolve, reject) => {
    // Build query path - filter by email if provided and not showing all
    let path = `/cms/v3/hubdb/tables/${tableId}/rows?limit=1000&sort=-createdAt`;

    // If userEmail provided and not admin viewing all, filter by email
    if (userEmail && !showAll) {
      // HubDB filtering uses the 'filters' parameter
      // Format: column__eq=value or use POST with filter body
      path += `&created_by_email__eq=${encodeURIComponent(userEmail)}`;
    }

    const options = {
      hostname: 'api.hubapi.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          // If HubDB filtering didn't work, filter manually
          let rows = result.results || [];

          if (userEmail && !showAll && rows.length > 0) {
            // Double-check filtering in case HubDB filter syntax varies
            rows = rows.filter(row =>
              row.values && row.values.created_by_email === userEmail
            );
          }

          resolve(rows);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
