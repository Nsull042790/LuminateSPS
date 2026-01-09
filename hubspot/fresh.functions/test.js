// Simple test endpoint - v5.1
exports.main = async (context, sendResponse) => {
  console.log('Test endpoint v5.1 called');
  sendResponse({
    statusCode: 200,
    body: {
      success: true,
      message: 'Property Generator API v5.1 is working!',
      version: '5.1',
      timestamp: new Date().toISOString(),
      tableId: process.env.HUBDB_TABLE_ID || 'NOT SET',
      tokenAvailable: !!process.env.HUBSPOT_PRIVATE_APP_TOKEN
    }
  });
};
