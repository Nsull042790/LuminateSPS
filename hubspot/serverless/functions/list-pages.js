// HubSpot Serverless Function - List Property Pages
const https = require('https');

exports.main = async (context, sendResponse) => {
  try {
    const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const portalId = process.env.HUBSPOT_PORTAL_ID;

    // Get landing pages with 'properties/' in the slug
    const pages = await getLandingPages(accessToken);

    // Filter to only property pages
    const propertyPages = pages.filter(page =>
      page.slug && page.slug.startsWith('properties/')
    ).map(page => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      url: `https://${portalId}.hs-sites.com/${page.slug}`,
      state: page.state,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt
    }));

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        pages: propertyPages,
        total: propertyPages.length
      }
    });
  } catch (error) {
    console.error('List pages error:', error);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

async function getLandingPages(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path: '/cms/v3/pages/landing-pages?limit=100&sort=-createdAt',
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
          resolve(result.results || []);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
