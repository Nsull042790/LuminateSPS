// Simple test endpoint - v5.0
exports.main = async (context, sendResponse) => {
  console.log('Test endpoint v5.0 called');
  sendResponse({
    statusCode: 200,
    body: {
      success: true,
      message: 'Property Generator API v5.0 is working!',
      version: '5.0',
      timestamp: new Date().toISOString(),
      tableId: process.env.HUBDB_TABLE_ID || 'NOT SET',
      tokenAvailable: !!process.env.HUBSPOT_PRIVATE_APP_TOKEN
    }
  });
};
