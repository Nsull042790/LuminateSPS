// Upload File to HubSpot File Manager
const https = require('https');

exports.main = async (context, sendResponse) => {
  const { file, fileName, folderPath } = context.body;

  if (!file || !fileName) {
    return sendResponse({
      statusCode: 400,
      body: { error: 'Missing file or fileName' }
    });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  try {
    // Convert base64 file to buffer
    const fileBuffer = Buffer.from(file, 'base64');
    const folder = folderPath || '/property-generator';

    // Upload to HubSpot File Manager using multipart form
    const result = await uploadToHubSpot(token, fileBuffer, fileName, folder);

    sendResponse({
      statusCode: 200,
      body: {
        success: true,
        url: result.url,
        id: result.id
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

function uploadToHubSpot(token, fileBuffer, fileName, folderPath) {
  return new Promise((resolve, reject) => {
    // Create multipart boundary
    const boundary = '----FormBoundary' + Date.now().toString(16);

    // Build multipart body
    let body = '';

    // File part
    body += '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="file"; filename="' + fileName + '"\r\n';
    body += 'Content-Type: application/octet-stream\r\n\r\n';

    // Options part
    const optionsJson = JSON.stringify({
      access: 'PUBLIC_INDEXABLE',
      overwrite: false
    });

    // Folder path part
    const folderPathPart = '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="folderPath"\r\n\r\n' +
      folderPath + '\r\n';

    const optionsPart = '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="options"\r\n\r\n' +
      optionsJson + '\r\n';

    const endPart = '--' + boundary + '--\r\n';

    // Combine all parts with the file buffer
    const preFileBuffer = Buffer.from(body);
    const postFileBuffer = Buffer.from('\r\n' + folderPathPart + optionsPart + endPart);
    const fullBody = Buffer.concat([preFileBuffer, fileBuffer, postFileBuffer]);

    const options = {
      hostname: 'api.hubapi.com',
      path: '/files/v3/files',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': fullBody.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.url) {
            resolve(result);
          } else {
            reject(new Error(result.message || 'Upload failed: ' + data));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}
