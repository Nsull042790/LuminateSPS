// Simple test endpoint
exports.main = async (context, sendResponse) => {
  sendResponse({
    statusCode: 200,
    body: {
      success: true,
      message: 'Property Generator API is working!',
      timestamp: new Date().toISOString()
    }
  });
};
