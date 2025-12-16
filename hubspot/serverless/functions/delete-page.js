// HubSpot Serverless Function - Delete Property Page
const https = require('https');

exports.main = async (context, sendResponse) => {
  const { pageId } = context.body;

  if (!pageId) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing pageId' }
    });
  }

  try {
    const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

    // First archive the page (soft delete)
    await archivePage(accessToken, pageId);

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        message: 'Page deleted successfully'
      }
    });
  } catch (error) {
    console.error('Delete page error:', error);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

async function archivePage(accessToken, pageId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path: `/cms/v3/pages/landing-pages/${pageId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({ success: true });
        } else {
          try {
            const result = JSON.parse(data);
            reject(new Error(result.message || 'Failed to delete page'));
          } catch (e) {
            reject(new Error('Failed to delete page'));
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
