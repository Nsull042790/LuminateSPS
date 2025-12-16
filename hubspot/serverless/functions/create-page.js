// HubSpot Serverless Function - Create Landing Page
const https = require('https');

exports.main = async (context, sendResponse) => {
  const { name, slug, htmlContent, metaDescription } = context.body;

  if (!name || !slug || !htmlContent) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing required fields: name, slug, htmlContent' }
    });
  }

  try {
    const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const portalId = process.env.HUBSPOT_PORTAL_ID;

    // Create the landing page
    const page = await createLandingPage(accessToken, {
      name: name,
      slug: `properties/${slug}`,
      htmlTitle: name,
      metaDescription: metaDescription || `Property listing for ${name}`,
      htmlContent: htmlContent,
      state: 'PUBLISHED'
    });

    const pageUrl = `https://${portalId}.hs-sites.com/properties/${slug}`;

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        pageId: page.id,
        url: pageUrl,
        slug: slug
      }
    });
  } catch (error) {
    console.error('Create page error:', error);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

async function createLandingPage(accessToken, pageData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: pageData.name,
      slug: pageData.slug,
      state: pageData.state,
      htmlTitle: pageData.htmlTitle,
      metaDescription: pageData.metaDescription,
      layoutSections: {
        main: {
          rows: [
            {
              columns: [
                {
                  width: 12,
                  widgets: [
                    {
                      type: 'raw_html',
                      body: {
                        html: pageData.htmlContent
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    });

    const options = {
      hostname: 'api.hubapi.com',
      path: '/cms/v3/pages/landing-pages',
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
            reject(new Error(result.message || 'Failed to create page'));
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
