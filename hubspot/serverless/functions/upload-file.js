// HubSpot Serverless Function - Upload File to File Manager
// Uses @hubspot/api-client which is available in serverless environment
const hubspot = require('@hubspot/api-client');

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

    // Initialize HubSpot client
    const hubspotClient = new hubspot.Client({ accessToken });

    // Convert base64 file to buffer
    const fileBuffer = Buffer.from(file, 'base64');

    // Create file upload options
    const options = {
      access: 'PUBLIC_INDEXABLE',
      overwrite: false,
      duplicateValidationStrategy: 'NONE',
      duplicateValidationScope: 'ENTIRE_PORTAL'
    };

    // Upload file using HubSpot API client
    const response = await hubspotClient.files.filesApi.upload(
      {
        data: fileBuffer,
        name: fileName
      },
      folderPath || '/property-generator',
      undefined, // folderId
      fileName,
      undefined, // charsetHunch
      JSON.stringify(options)
    );

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
      body: { error: error.message || 'Upload failed' }
    });
  }
};
