/**
 * Luminate Property Site Generator - Express Server
 */

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const slugify = require('slugify');
const { generatePropertyHTML } = require('./template');
const { GitHubPublisher } = require('./github');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set permissive CSP headers for Codespaces compatibility
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' https:; connect-src 'self' https:;"
  );
  next();
});

app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize GitHub publisher
let githubPublisher = null;

function initGitHubPublisher() {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('Warning: GITHUB_TOKEN not set. GitHub publishing will be disabled.');
    return null;
  }
  return new GitHubPublisher({
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO || 'LuminateSPS',
    branch: process.env.GITHUB_BRANCH || 'main',
    pagesBaseUrl: process.env.GITHUB_PAGES_BASE_URL
  });
}

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    githubConfigured: !!process.env.GITHUB_TOKEN,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get GitHub configuration status
 */
app.get('/api/config', (req, res) => {
  res.json({
    githubConfigured: !!process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER || null,
    repo: process.env.GITHUB_REPO || 'LuminateSPS',
    pagesUrl: process.env.GITHUB_PAGES_BASE_URL ||
      (process.env.GITHUB_OWNER ? `https://${process.env.GITHUB_OWNER}.github.io/${process.env.GITHUB_REPO || 'LuminateSPS'}` : null)
  });
});

/**
 * Upload images endpoint
 */
app.post('/api/upload', upload.array('photos', 20), async (req, res) => {
  try {
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size
    }));
    res.json({ success: true, files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate and publish property site
 */
app.post('/api/generate', async (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    const requiredFields = [
      'property.address', 'property.city', 'property.state', 'property.zip',
      'property.price', 'property.bedrooms', 'property.bathrooms', 'property.sqft',
      'property.yearBuilt', 'property.description',
      'realtor.name', 'realtor.company', 'realtor.license', 'realtor.phone', 'realtor.email',
      'loanOfficer.name', 'loanOfficer.company', 'loanOfficer.nmls', 'loanOfficer.phone', 'loanOfficer.email'
    ];

    const missingFields = [];
    for (const field of requiredFields) {
      const parts = field.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
      }
      if (!value) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        missingFields
      });
    }

    // Generate property slug
    const propertySlug = slugify(
      `${data.property.address}-${data.property.city}`,
      { lower: true, strict: true }
    );

    // Process photos - convert uploaded files to URLs or base64
    const photos = [];
    if (data.photos && Array.isArray(data.photos)) {
      for (const photo of data.photos) {
        if (photo.url) {
          // External URL
          photos.push({ url: photo.url, label: photo.label });
        } else if (photo.path) {
          // Local uploaded file - read and convert to base64 for GitHub
          try {
            const filePath = path.join(__dirname, '..', photo.path);
            const fileBuffer = await fs.readFile(filePath);
            const base64Content = fileBuffer.toString('base64');
            const ext = path.extname(photo.path);
            const filename = `photo-${photos.length + 1}${ext}`;

            photos.push({
              url: `./images/${filename}`,
              label: photo.label,
              base64Content,
              filename
            });
          } catch (err) {
            console.error('Error reading photo:', err);
          }
        }
      }
    }

    // Add GitHub config to data for QR code generation
    data.githubOwner = process.env.GITHUB_OWNER;
    data.githubRepo = process.env.GITHUB_REPO || 'LuminateSPS';
    data.propertySlug = propertySlug;

    // Generate HTML
    const htmlContent = generatePropertyHTML({
      property: data.property,
      realtor: data.realtor,
      loanOfficer: data.loanOfficer,
      photos: photos.map(p => ({ url: p.url, label: p.label })),
      testimonials: data.testimonials || [],
      githubOwner: data.githubOwner,
      githubRepo: data.githubRepo,
      propertySlug
    });

    // If GitHub is configured, publish to GitHub Pages
    if (process.env.GITHUB_TOKEN) {
      if (!githubPublisher) {
        githubPublisher = initGitHubPublisher();
      }

      const result = await githubPublisher.publishPropertySite(
        propertySlug,
        htmlContent,
        photos.filter(p => p.base64Content)
      );

      // Clean up uploaded files
      for (const photo of data.photos || []) {
        if (photo.path) {
          try {
            await fs.unlink(path.join(__dirname, '..', photo.path));
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      }

      res.json({
        success: true,
        published: true,
        url: result.url,
        propertySlug,
        message: 'Property site published successfully! It may take 1-2 minutes to appear on GitHub Pages.'
      });
    } else {
      // No GitHub config - return HTML for download
      res.json({
        success: true,
        published: false,
        html: htmlContent,
        propertySlug,
        message: 'HTML generated successfully. Configure GitHub to auto-publish.'
      });
    }
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List all property sites
 */
app.get('/api/properties', async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return res.json({ success: true, properties: [] });
    }

    if (!githubPublisher) {
      githubPublisher = initGitHubPublisher();
    }

    const properties = await githubPublisher.listPropertySites();
    res.json({ success: true, properties });
  } catch (error) {
    console.error('Error listing properties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a property site
 */
app.delete('/api/properties/:slug', async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({ success: false, error: 'GitHub not configured' });
    }

    if (!githubPublisher) {
      githubPublisher = initGitHubPublisher();
    }

    await githubPublisher.deletePropertySite(req.params.slug);
    res.json({ success: true, message: 'Property site deleted' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Preview endpoint - generates HTML without publishing
 */
app.post('/api/preview', (req, res) => {
  try {
    const data = req.body;

    // Generate property slug
    const propertySlug = slugify(
      `${data.property?.address || 'preview'}-${data.property?.city || 'city'}`,
      { lower: true, strict: true }
    );

    // Use placeholder data for missing fields in preview
    const previewData = {
      property: {
        address: '123 Main St',
        city: 'City',
        state: 'ST',
        zip: '00000',
        price: 500000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 2000,
        yearBuilt: 2000,
        description: 'Beautiful property description goes here.',
        ...data.property
      },
      realtor: {
        name: 'Realtor Name',
        company: 'Realty Company',
        license: 'RE123456',
        phone: '(555) 123-4567',
        email: 'realtor@example.com',
        ...data.realtor
      },
      loanOfficer: {
        name: 'Loan Officer Name',
        company: 'Lending Company',
        nmls: '123456',
        phone: '(555) 987-6543',
        email: 'lo@example.com',
        ...data.loanOfficer
      },
      photos: data.photos || [
        { url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', label: 'Front Exterior' }
      ],
      testimonials: data.testimonials || [],
      githubOwner: process.env.GITHUB_OWNER || 'OWNER',
      githubRepo: process.env.GITHUB_REPO || 'LuminateSPS',
      propertySlug
    };

    const htmlContent = generatePropertyHTML(previewData);

    res.json({
      success: true,
      html: htmlContent
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Luminate Property Site Generator                      ║
║     Server running at http://localhost:${PORT}              ║
╠═══════════════════════════════════════════════════════════╣
║  GitHub: ${process.env.GITHUB_TOKEN ? '✓ Configured' : '✗ Not configured (set GITHUB_TOKEN)'}                          ║
║  Owner:  ${process.env.GITHUB_OWNER || 'Not set'}
║  Repo:   ${process.env.GITHUB_REPO || 'LuminateSPS'}
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
