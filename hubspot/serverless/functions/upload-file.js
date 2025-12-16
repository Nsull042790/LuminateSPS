// HubSpot Serverless Function - Upload File to File Manager
const https = require('https');
const FormData = require('form-data');

exports.main = async (context, sendResponse) => {
  const { file, fileName, folderPath } = context.body;

  if (!file || !fileName) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing file or fileName' }
    });
  }

  try {
    const accessToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

    // Convert base64 file to buffer
    const fileBuffer = Buffer.from(file, 'base64');

    // Upload to HubSpot File Manager
    const response = await uploadToHubSpot(accessToken, fileBuffer, fileName, folderPath || '/property-generator');

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        url: response.url,
        id: response.id
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    sendResponse({
      statusCode: 500,
      body: { error: error.message }
    });
  }
};

async function uploadToHubSpot(accessToken, fileBuffer, fileName, folderPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path: '/files/v3/files',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName });
    form.append('options', JSON.stringify({
      access: 'PUBLIC_INDEXABLE',
      overwrite: false
    }));
    form.append('folderPath', folderPath);

    Object.assign(options.headers, form.getHeaders());

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.url) {
            resolve(result);
          } else {
            reject(new Error(result.message || 'Upload failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}
