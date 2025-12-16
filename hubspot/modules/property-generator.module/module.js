// Property Generator Module JavaScript v2.2 - Added Social Sharing
// Uses HubSpot Serverless Functions for API calls
(function() {
  var uploadedPhotos = [];
  var realtorPhoto = null;
  var loanOfficerPhoto = null;

  // Serverless function endpoints
  var API_BASE = '/_hcms/api';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Property Generator v2.1 initialized');
    setupPhotoUpload();
    setupContactPhotoUploads();
    setupFormHandlers();
    setupModalHandlers();
    setupNeighborhoodToggle();
    loadExistingSites();
  });

  // Photo Upload Setup
  function setupPhotoUpload() {
    var uploadArea = document.getElementById('photo-upload-area');
    var photoInput = document.getElementById('photo-input');

    if (!uploadArea || !photoInput) return;

    uploadArea.addEventListener('click', function() {
      photoInput.click();
    });

    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function() {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      handlePhotoFiles(e.dataTransfer.files);
    });

    photoInput.addEventListener('change', function(e) {
      handlePhotoFiles(e.target.files);
    });
  }

  function handlePhotoFiles(files) {
    for (var i = 0; i < files.length; i++) {
      if (uploadedPhotos.length >= 20) {
        showToast('Maximum 20 photos allowed', 'error');
        break;
      }
      uploadFile(files[i], function(url) {
        uploadedPhotos.push({
          url: url,
          label: ''
        });
        renderPhotoPreview();
      });
    }
  }

  function uploadFile(file, callback) {
    showToast('Uploading ' + file.name + '...', 'info');

    // Convert file to base64
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];

      fetch(API_BASE + '/upload-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file: base64,
          fileName: file.name,
          folderPath: '/property-generator'
        })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.url) {
          showToast('Photo uploaded!', 'success');
          callback(data.url);
        } else {
          showToast('Upload failed: ' + (data.error || 'Unknown error'), 'error');
        }
      })
      .catch(function(err) {
        console.error('Upload error:', err);
        showToast('Upload failed', 'error');
      });
    };
    reader.readAsDataURL(file);
  }

  function renderPhotoPreview() {
    var grid = document.getElementById('photo-preview');
    if (!grid) return;

    var html = '';
    for (var i = 0; i < uploadedPhotos.length; i++) {
      var photo = uploadedPhotos[i];
      html += '<div class="pg-photo-item">';
      html += '<img src="' + photo.url + '" alt="Photo ' + (i + 1) + '">';
      html += '<button type="button" class="remove-btn" data-index="' + i + '">&times;</button>';
      html += '</div>';
    }
    grid.innerHTML = html;

    var removeBtns = grid.querySelectorAll('.remove-btn');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', function() {
        var index = parseInt(this.getAttribute('data-index'));
        uploadedPhotos.splice(index, 1);
        renderPhotoPreview();
      });
    }
  }

  // Contact Photo Uploads
  function setupContactPhotoUploads() {
    setupSinglePhotoUpload('realtor-photo-input', 'realtor-avatar', function(url) {
      realtorPhoto = url;
    });
    setupSinglePhotoUpload('lo-photo-input', 'lo-avatar', function(url) {
      loanOfficerPhoto = url;
    });
  }

  function setupSinglePhotoUpload(inputId, avatarId, callback) {
    var input = document.getElementById(inputId);
    var avatar = document.getElementById(avatarId);

    if (!input || !avatar) return;

    avatar.addEventListener('click', function() {
      input.click();
    });

    input.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        uploadFile(file, function(url) {
          callback(url);
          avatar.innerHTML = '<img src="' + url + '" alt="Photo">';
        });
      }
    });
  }

  // Form Handlers
  function setupFormHandlers() {
    var generateBtn = document.getElementById('generate-btn');
    var previewBtn = document.getElementById('preview-btn');
    var clearBtn = document.getElementById('clear-btn');

    if (generateBtn) generateBtn.addEventListener('click', generateSite);
    if (previewBtn) previewBtn.addEventListener('click', previewSite);
    if (clearBtn) clearBtn.addEventListener('click', clearForm);

    // Format price input
    var priceInput = document.querySelector('input[name="price"]');
    if (priceInput) {
      priceInput.addEventListener('blur', function() {
        var value = parseFloat(this.value.replace(/[$,]/g, '')) || 0;
        if (value > 0) {
          this.value = '$' + value.toLocaleString();
        }
      });
    }

    // Format sqft input
    var sqftInput = document.querySelector('input[name="sqft"]');
    if (sqftInput) {
      sqftInput.addEventListener('blur', function() {
        var value = parseFloat(this.value.replace(/,/g, '')) || 0;
        if (value > 0) {
          this.value = value.toLocaleString();
        }
      });
    }
  }

  function setupModalHandlers() {
    var previewClose = document.getElementById('preview-close');
    var previewCloseBtn = document.getElementById('preview-close-btn');
    var publishBtn = document.getElementById('publish-from-preview');
    var successClose = document.getElementById('success-close');
    var copyUrlBtn = document.getElementById('copy-url');

    if (previewClose) previewClose.addEventListener('click', closePreviewModal);
    if (previewCloseBtn) previewCloseBtn.addEventListener('click', closePreviewModal);
    if (publishBtn) publishBtn.addEventListener('click', function() {
      closePreviewModal();
      generateSite();
    });
    if (successClose) successClose.addEventListener('click', closeSuccessModal);
    if (copyUrlBtn) copyUrlBtn.addEventListener('click', copyUrl);
  }

  function setupNeighborhoodToggle() {
    var toggle = document.getElementById('show-neighborhood');
    var fields = document.getElementById('neighborhood-fields');

    if (toggle && fields) {
      toggle.addEventListener('change', function() {
        if (this.checked) {
          fields.classList.remove('hidden');
        } else {
          fields.classList.add('hidden');
        }
      });
    }
  }

  function getFormData() {
    var form = document.getElementById('property-form');
    var data = {
      property: {
        address: getValue('address'),
        city: getValue('city'),
        state: getValue('state'),
        zip: getValue('zip'),
        price: parseFloat((getValue('price') || '').replace(/[$,]/g, '')) || 0,
        bedrooms: parseInt(getValue('bedrooms')) || 0,
        bathrooms: getValue('bathrooms') || '',
        sqft: parseFloat((getValue('sqft') || '').replace(/,/g, '')) || 0,
        yearBuilt: parseInt(getValue('yearBuilt')) || 0,
        mlsNumber: getValue('mlsNumber') || '',
        description: getValue('description') || '',
        features: getValue('features') || ''
      },
      realtor: {
        name: getValue('realtorName'),
        title: getValue('realtorTitle') || 'Licensed Realtor',
        company: getValue('realtorCompany') || '',
        phone: getValue('realtorPhone') || '',
        email: getValue('realtorEmail') || '',
        license: getValue('realtorLicense') || '',
        photo: realtorPhoto
      },
      loanOfficer: {
        name: getValue('loName'),
        title: getValue('loTitle') || 'Loan Officer',
        company: getValue('loCompany') || '',
        phone: getValue('loPhone') || '',
        email: getValue('loEmail') || '',
        nmls: getValue('loNmls') || '',
        photo: loanOfficerPhoto
      },
      photos: uploadedPhotos,
      showNeighborhood: document.getElementById('show-neighborhood') ? document.getElementById('show-neighborhood').checked : true,
      neighborhood: {
        walkScore: parseInt(getValue('walkScore')) || 0,
        transitScore: parseInt(getValue('transitScore')) || 0,
        bikeScore: parseInt(getValue('bikeScore')) || 0,
        amenities: getValue('amenities') || ''
      }
    };
    return data;

    function getValue(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? el.value : '';
    }
  }

  function generateSite() {
    var data = getFormData();

    if (!data.property.address || !data.realtor.name || !data.loanOfficer.name) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    var btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    var html = generatePropertyHTML(data);
    var slug = slugify(data.property.address + '-' + data.property.city);
    var pageName = data.property.address + ', ' + data.property.city;

    fetch(API_BASE + '/create-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: pageName,
        slug: slug,
        htmlContent: html,
        metaDescription: 'Beautiful property at ' + pageName
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      btn.disabled = false;
      btn.textContent = '🚀 Generate & Publish';

      if (result.success && result.url) {
        document.getElementById('success-url').textContent = result.url;
        document.getElementById('success-url').href = result.url;
        document.getElementById('success-modal').classList.add('active');
        loadExistingSites();
        showToast('Site published!', 'success');
      } else {
        showToast('Error: ' + (result.error || 'Could not create page'), 'error');
      }
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = '🚀 Generate & Publish';
      showToast('Error creating page', 'error');
      console.error(err);
    });
  }

  function previewSite() {
    var data = getFormData();

    if (!data.property.address) {
      showToast('Please enter a property address', 'error');
      return;
    }

    var html = generatePropertyHTML(data);
    var iframe = document.getElementById('preview-iframe');
    iframe.srcdoc = html;
    document.getElementById('preview-modal').classList.add('active');
  }

  function generatePropertyHTML(data) {
    var p = data.property;
    var r = data.realtor;
    var lo = data.loanOfficer;
    var photos = data.photos;
    var n = data.neighborhood;

    // Features list
    var featuresHtml = '';
    if (p.features) {
      var featuresList = p.features.split(',');
      featuresHtml = '<ul class="features-list">';
      for (var i = 0; i < featuresList.length; i++) {
        var f = featuresList[i].trim();
        if (f) featuresHtml += '<li>✓ ' + f + '</li>';
      }
      featuresHtml += '</ul>';
    }

    // Gallery
    var galleryHtml = '';
    for (var j = 0; j < photos.length; j++) {
      galleryHtml += '<div class="gallery-item" data-index="' + j + '">';
      galleryHtml += '<img src="' + photos[j].url + '" alt="Property Photo ' + (j+1) + '">';
      galleryHtml += '</div>';
    }

    // Gallery JS data
    var galleryJs = 'var galleryImages = [';
    for (var k = 0; k < photos.length; k++) {
      galleryJs += '"' + photos[k].url + '"';
      if (k < photos.length - 1) galleryJs += ',';
    }
    galleryJs += '];';

    // Page URL and description for sharing
    var pageTitle = p.address + ', ' + p.city + ', ' + p.state + ' - $' + p.price.toLocaleString();
    var pageDescription = p.bedrooms + ' bed, ' + p.bathrooms + ' bath, ' + p.sqft.toLocaleString() + ' sq ft home in ' + p.city + ', ' + p.state + '. ' + (p.description ? p.description.substring(0, 150) : 'Beautiful property for sale.');
    var heroImage = photos[0] ? photos[0].url : '';

    var html = '<!DOCTYPE html><html lang="en"><head>';
    html += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
    html += '<title>' + pageTitle + '</title>';
    html += '<meta name="description" content="' + pageDescription + '">';

    // Open Graph Tags (Facebook, LinkedIn)
    html += '<meta property="og:type" content="website">';
    html += '<meta property="og:title" content="' + pageTitle + '">';
    html += '<meta property="og:description" content="' + pageDescription + '">';
    html += '<meta property="og:image" content="' + heroImage + '">';
    html += '<meta property="og:image:width" content="1200">';
    html += '<meta property="og:image:height" content="630">';

    // Twitter Card Tags
    html += '<meta name="twitter:card" content="summary_large_image">';
    html += '<meta name="twitter:title" content="' + pageTitle + '">';
    html += '<meta name="twitter:description" content="' + pageDescription + '">';
    html += '<meta name="twitter:image" content="' + heroImage + '">';

    html += '<style>';
    html += '* { margin: 0; padding: 0; box-sizing: border-box; }';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #333; }';
    html += '.hero { position: relative; height: 70vh; background: url("' + (photos[0] ? photos[0].url : '') + '") center/cover; }';
    html += '.hero-overlay { position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgba(0,0,0,0.85)); display: flex; align-items: flex-end; padding: 40px; }';
    html += '.hero-content { color: white; max-width: 900px; }';
    html += '.hero h1 { font-size: 2.8em; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }';
    html += '.hero .location { font-size: 1.2em; opacity: 0.9; }';
    html += '.hero .price { font-size: 2.5em; color: #667eea; font-weight: bold; margin-top: 15px; }';
    html += '.stats { display: flex; gap: 40px; margin-top: 25px; }';
    html += '.stat { text-align: center; }';
    html += '.stat-value { font-size: 1.8em; font-weight: bold; }';
    html += '.stat-label { font-size: 0.9em; opacity: 0.8; }';
    html += '.section { padding: 60px 40px; max-width: 1200px; margin: 0 auto; }';
    html += '.section-dark { background: #f7fafc; }';
    html += '.section-title { font-size: 2em; color: #0d173c; margin-bottom: 30px; display: flex; align-items: center; gap: 15px; }';
    html += '.section-title:before { content: ""; display: block; width: 5px; height: 35px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 3px; }';
    html += '.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }';
    html += '.gallery-item { cursor: pointer; overflow: hidden; border-radius: 12px; }';
    html += '.gallery-item img { width: 100%; height: 250px; object-fit: cover; transition: transform 0.3s; }';
    html += '.gallery-item:hover img { transform: scale(1.05); }';
    html += '.description { font-size: 1.1em; line-height: 1.8; color: #4a5568; }';
    html += '.features-list { columns: 2; list-style: none; margin-top: 20px; }';
    html += '.features-list li { padding: 10px 0; font-size: 1.05em; }';
    html += '@media (max-width: 600px) { .features-list { columns: 1; } }';

    // Contact cards
    html += '.contacts { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; }';
    html += '.contact-card { background: white; border-radius: 16px; padding: 30px; display: flex; gap: 25px; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }';
    html += '.contact-photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #667eea; }';
    html += '.contact-photo-placeholder { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 2.5em; color: white; }';
    html += '.contact-photo-placeholder.lo { background: linear-gradient(135deg, #11998e, #38ef7d); }';
    html += '.contact-info h3 { color: #0d173c; font-size: 1.3em; margin-bottom: 5px; }';
    html += '.contact-info .title { color: #667eea; font-weight: 600; margin-bottom: 10px; }';
    html += '.contact-info p { color: #718096; font-size: 0.95em; margin: 5px 0; }';
    html += '.contact-info a { color: #667eea; text-decoration: none; }';
    html += '.contact-info a:hover { text-decoration: underline; }';

    // Mortgage calculator
    html += '.calculator { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 500px; }';
    html += '.calc-input { display: flex; flex-direction: column; margin-bottom: 20px; }';
    html += '.calc-input label { font-weight: 600; margin-bottom: 8px; color: #4a5568; }';
    html += '.calc-input input { padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1em; }';
    html += '.calc-result { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 25px; border-radius: 12px; text-align: center; margin-top: 20px; }';
    html += '.calc-result .amount { font-size: 2.5em; font-weight: bold; }';
    html += '.calc-result .label { opacity: 0.9; margin-top: 5px; }';

    // Footer
    html += '.footer { background: #0d173c; color: white; padding: 40px; text-align: center; }';
    html += '.footer p { margin: 5px 0; }';
    html += '.footer .disclaimer { font-size: 0.85em; opacity: 0.7; margin-top: 20px; }';

    // Lightbox
    html += '.lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 1000; align-items: center; justify-content: center; }';
    html += '.lightbox.active { display: flex; }';
    html += '.lightbox img { max-width: 90%; max-height: 90%; object-fit: contain; }';
    html += '.lightbox-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; cursor: pointer; }';
    html += '.lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); color: white; font-size: 50px; cursor: pointer; padding: 20px; }';
    html += '.lightbox-prev { left: 20px; }';
    html += '.lightbox-next { right: 20px; }';

    // Share buttons
    html += '.share-bar { background: white; padding: 15px 40px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; }';
    html += '.share-bar-title { font-weight: 600; color: #4a5568; }';
    html += '.share-buttons { display: flex; gap: 10px; flex-wrap: wrap; }';
    html += '.share-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; border: none; }';
    html += '.share-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }';
    html += '.share-btn-facebook { background: #1877f2; color: white; }';
    html += '.share-btn-twitter { background: #000000; color: white; }';
    html += '.share-btn-linkedin { background: #0a66c2; color: white; }';
    html += '.share-btn-email { background: #ea4335; color: white; }';
    html += '.share-btn-sms { background: #25d366; color: white; }';
    html += '.share-btn-copy { background: #6b7280; color: white; }';
    html += '.share-btn svg { width: 18px; height: 18px; fill: currentColor; }';
    html += '@media (max-width: 768px) { .share-bar { padding: 12px 20px; } .share-btn span { display: none; } .share-btn { padding: 10px; } }';

    // Copy toast notification
    html += '.copy-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #0d173c; color: white; padding: 12px 24px; border-radius: 8px; font-weight: 500; opacity: 0; transition: opacity 0.3s; z-index: 1001; }';
    html += '.copy-toast.show { opacity: 1; }';

    html += '</style></head><body>';

    // Hero Section
    html += '<section class="hero"><div class="hero-overlay"><div class="hero-content">';
    html += '<h1>' + p.address + '</h1>';
    html += '<p class="location">' + p.city + ', ' + p.state + ' ' + p.zip + '</p>';
    html += '<div class="price">$' + p.price.toLocaleString() + '</div>';
    html += '<div class="stats">';
    if (p.bedrooms) html += '<div class="stat"><div class="stat-value">' + p.bedrooms + '</div><div class="stat-label">Bedrooms</div></div>';
    if (p.bathrooms) html += '<div class="stat"><div class="stat-value">' + p.bathrooms + '</div><div class="stat-label">Bathrooms</div></div>';
    if (p.sqft) html += '<div class="stat"><div class="stat-value">' + p.sqft.toLocaleString() + '</div><div class="stat-label">Sq Ft</div></div>';
    if (p.yearBuilt) html += '<div class="stat"><div class="stat-value">' + p.yearBuilt + '</div><div class="stat-label">Year Built</div></div>';
    html += '</div></div></div></section>';

    // Share Bar - prepare share URLs (URL is injected dynamically via JS when page loads)
    var shareText = encodeURIComponent(pageTitle);
    var shareDesc = encodeURIComponent(pageDescription);

    html += '<div class="share-bar">';
    html += '<span class="share-bar-title">Share this property:</span>';
    html += '<div class="share-buttons">';

    // Facebook - uses current URL
    html += '<a href="https://www.facebook.com/sharer/sharer.php?u=" class="share-btn share-btn-facebook" target="_blank" rel="noopener" id="share-facebook">';
    html += '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
    html += '<span>Facebook</span></a>';

    // Twitter/X
    html += '<a href="https://twitter.com/intent/tweet?text=' + shareText + '&url=" class="share-btn share-btn-twitter" target="_blank" rel="noopener" id="share-twitter">';
    html += '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
    html += '<span>Tweet</span></a>';

    // LinkedIn
    html += '<a href="https://www.linkedin.com/sharing/share-offsite/?url=" class="share-btn share-btn-linkedin" target="_blank" rel="noopener" id="share-linkedin">';
    html += '<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
    html += '<span>LinkedIn</span></a>';

    // Email
    html += '<a href="mailto:?subject=' + shareText + '&body=Check out this property: " class="share-btn share-btn-email" id="share-email">';
    html += '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';
    html += '<span>Email</span></a>';

    // SMS (great for mobile)
    html += '<a href="sms:?body=' + shareText + ' - " class="share-btn share-btn-sms" id="share-sms">';
    html += '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
    html += '<span>Text</span></a>';

    // Copy Link
    html += '<button class="share-btn share-btn-copy" id="copy-link-btn">';
    html += '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    html += '<span>Copy Link</span></button>';

    html += '</div></div>';

    // Copy toast
    html += '<div class="copy-toast" id="copy-toast">Link copied to clipboard!</div>';

    // Gallery Section
    if (photos.length > 0) {
      html += '<section class="section"><h2 class="section-title">Photo Gallery</h2>';
      html += '<div class="gallery">' + galleryHtml + '</div></section>';
    }

    // Description Section
    if (p.description || p.features) {
      html += '<section class="section section-dark">';
      if (p.description) {
        html += '<h2 class="section-title">About This Property</h2>';
        html += '<p class="description">' + p.description + '</p>';
      }
      if (featuresHtml) {
        html += '<h2 class="section-title" style="margin-top:50px;">Property Features</h2>';
        html += featuresHtml;
      }
      html += '</section>';
    }

    // Mortgage Calculator
    html += '<section class="section"><h2 class="section-title">Mortgage Calculator</h2>';
    html += '<div class="calculator">';
    html += '<div class="calc-input"><label>Home Price</label><input type="text" id="calc-price" value="$' + p.price.toLocaleString() + '"></div>';
    html += '<div class="calc-input"><label>Down Payment (%)</label><input type="number" id="calc-down" value="20"></div>';
    html += '<div class="calc-input"><label>Interest Rate (%)</label><input type="number" id="calc-rate" value="6.5" step="0.1"></div>';
    html += '<div class="calc-input"><label>Loan Term (years)</label><input type="number" id="calc-term" value="30"></div>';
    html += '<div class="calc-result"><div class="amount" id="calc-result">$0</div><div class="label">Estimated Monthly Payment</div></div>';
    html += '</div></section>';

    // Contacts Section
    html += '<section class="section section-dark"><h2 class="section-title">Contact Us</h2><div class="contacts">';

    // Realtor Card
    html += '<div class="contact-card">';
    if (r.photo) {
      html += '<img src="' + r.photo + '" alt="' + r.name + '" class="contact-photo">';
    } else {
      html += '<div class="contact-photo-placeholder">👤</div>';
    }
    html += '<div class="contact-info">';
    html += '<h3>' + r.name + '</h3>';
    html += '<p class="title">' + r.title + '</p>';
    if (r.company) html += '<p>' + r.company + '</p>';
    if (r.phone) html += '<p>📞 <a href="tel:' + r.phone + '">' + r.phone + '</a></p>';
    if (r.email) html += '<p>✉️ <a href="mailto:' + r.email + '">' + r.email + '</a></p>';
    if (r.license) html += '<p style="font-size:0.85em;color:#a0aec0;">' + r.license + '</p>';
    html += '</div></div>';

    // Loan Officer Card
    html += '<div class="contact-card">';
    if (lo.photo) {
      html += '<img src="' + lo.photo + '" alt="' + lo.name + '" class="contact-photo" style="border-color:#11998e;">';
    } else {
      html += '<div class="contact-photo-placeholder lo">👤</div>';
    }
    html += '<div class="contact-info">';
    html += '<h3>' + lo.name + '</h3>';
    html += '<p class="title" style="color:#11998e;">' + lo.title + '</p>';
    if (lo.company) html += '<p>' + lo.company + '</p>';
    if (lo.phone) html += '<p>📞 <a href="tel:' + lo.phone + '">' + lo.phone + '</a></p>';
    if (lo.email) html += '<p>✉️ <a href="mailto:' + lo.email + '">' + lo.email + '</a></p>';
    if (lo.nmls) html += '<p style="font-size:0.85em;color:#a0aec0;">NMLS# ' + lo.nmls + '</p>';
    html += '</div></div>';

    html += '</div></section>';

    // Footer
    html += '<footer class="footer">';
    html += '<p>© ' + new Date().getFullYear() + ' ' + (r.company || 'Real Estate') + ' & ' + (lo.company || 'Mortgage Services') + '</p>';
    if (p.mlsNumber) html += '<p style="margin-top:10px;">MLS# ' + p.mlsNumber + '</p>';
    html += '<p class="disclaimer">Equal Housing Opportunity. This is not a commitment to lend.</p>';
    html += '</footer>';

    // Lightbox
    html += '<div class="lightbox" id="lightbox">';
    html += '<span class="lightbox-close" id="lightbox-close">&times;</span>';
    html += '<span class="lightbox-nav lightbox-prev" id="lightbox-prev">&#10094;</span>';
    html += '<img src="" id="lightbox-img" alt="Property Photo">';
    html += '<span class="lightbox-nav lightbox-next" id="lightbox-next">&#10095;</span>';
    html += '</div>';

    // JavaScript
    html += '<script>';
    html += galleryJs;
    html += 'var currentIndex = 0;';

    // Calculator
    html += 'function calculate() {';
    html += '  var price = parseFloat(document.getElementById("calc-price").value.replace(/[$,]/g, "")) || 0;';
    html += '  var down = parseFloat(document.getElementById("calc-down").value) || 20;';
    html += '  var rate = parseFloat(document.getElementById("calc-rate").value) || 6.5;';
    html += '  var term = parseInt(document.getElementById("calc-term").value) || 30;';
    html += '  var principal = price * (1 - down/100);';
    html += '  var monthlyRate = rate / 100 / 12;';
    html += '  var payments = term * 12;';
    html += '  var payment = principal * (monthlyRate * Math.pow(1+monthlyRate, payments)) / (Math.pow(1+monthlyRate, payments) - 1);';
    html += '  document.getElementById("calc-result").textContent = "$" + Math.round(payment).toLocaleString();';
    html += '}';
    html += 'document.querySelectorAll(".calculator input").forEach(function(input) { input.addEventListener("input", calculate); });';
    html += 'calculate();';

    // Lightbox
    html += 'function openLightbox(index) {';
    html += '  currentIndex = index;';
    html += '  document.getElementById("lightbox-img").src = galleryImages[index];';
    html += '  document.getElementById("lightbox").classList.add("active");';
    html += '}';
    html += 'document.querySelectorAll(".gallery-item").forEach(function(item) {';
    html += '  item.addEventListener("click", function() { openLightbox(parseInt(this.getAttribute("data-index"))); });';
    html += '});';
    html += 'document.getElementById("lightbox-close").addEventListener("click", function() { document.getElementById("lightbox").classList.remove("active"); });';
    html += 'document.getElementById("lightbox-prev").addEventListener("click", function() { currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length; document.getElementById("lightbox-img").src = galleryImages[currentIndex]; });';
    html += 'document.getElementById("lightbox-next").addEventListener("click", function() { currentIndex = (currentIndex + 1) % galleryImages.length; document.getElementById("lightbox-img").src = galleryImages[currentIndex]; });';
    html += 'document.getElementById("lightbox").addEventListener("click", function(e) { if (e.target === this) this.classList.remove("active"); });';

    // Share buttons - update with current URL
    html += '(function() {';
    html += '  var pageUrl = encodeURIComponent(window.location.href);';
    html += '  var fbBtn = document.getElementById("share-facebook");';
    html += '  var twBtn = document.getElementById("share-twitter");';
    html += '  var liBtn = document.getElementById("share-linkedin");';
    html += '  var emBtn = document.getElementById("share-email");';
    html += '  var smsBtn = document.getElementById("share-sms");';
    html += '  if (fbBtn) fbBtn.href = fbBtn.href + pageUrl;';
    html += '  if (twBtn) twBtn.href = twBtn.href + pageUrl;';
    html += '  if (liBtn) liBtn.href = liBtn.href + pageUrl;';
    html += '  if (emBtn) emBtn.href = emBtn.href + window.location.href;';
    html += '  if (smsBtn) smsBtn.href = smsBtn.href + window.location.href;';

    // Copy link button
    html += '  var copyBtn = document.getElementById("copy-link-btn");';
    html += '  var copyToast = document.getElementById("copy-toast");';
    html += '  if (copyBtn) {';
    html += '    copyBtn.addEventListener("click", function() {';
    html += '      navigator.clipboard.writeText(window.location.href).then(function() {';
    html += '        copyToast.classList.add("show");';
    html += '        setTimeout(function() { copyToast.classList.remove("show"); }, 2000);';
    html += '      });';
    html += '    });';
    html += '  }';
    html += '})();';

    html += '</script></body></html>';

    return html;
  }

  function slugify(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function loadExistingSites() {
    fetch(API_BASE + '/list-pages')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var list = document.getElementById('sites-list');
        if (!list) return;

        if (data.success && data.pages && data.pages.length > 0) {
          var html = '';
          for (var i = 0; i < data.pages.length; i++) {
            var page = data.pages[i];
            html += '<div class="site-item" data-id="' + page.id + '">';
            html += '<a href="' + page.url + '" target="_blank">' + page.name + '</a>';
            html += '<div class="actions">';
            html += '<button type="button" class="copy-site-url" data-url="' + page.url + '" title="Copy URL">📋</button>';
            html += '<button type="button" class="delete-site" data-id="' + page.id + '" title="Delete">🗑️</button>';
            html += '</div></div>';
          }
          list.innerHTML = html;

          // Add handlers
          list.querySelectorAll('.copy-site-url').forEach(function(btn) {
            btn.addEventListener('click', function() {
              navigator.clipboard.writeText(this.getAttribute('data-url'));
              showToast('URL copied!', 'success');
            });
          });
          list.querySelectorAll('.delete-site').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var pageId = this.getAttribute('data-id');
              if (confirm('Delete this property site?')) {
                deleteSite(pageId);
              }
            });
          });
        } else {
          list.innerHTML = '<p class="no-sites">No sites generated yet</p>';
        }
      })
      .catch(function(err) {
        console.error('Error loading sites:', err);
      });
  }

  function deleteSite(pageId) {
    fetch(API_BASE + '/delete-page', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: pageId })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        showToast('Site deleted', 'success');
        loadExistingSites();
      } else {
        showToast('Error deleting site', 'error');
      }
    })
    .catch(function(err) {
      showToast('Error deleting site', 'error');
    });
  }

  function closePreviewModal() {
    document.getElementById('preview-modal').classList.remove('active');
  }

  function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
  }

  function copyUrl() {
    var url = document.getElementById('success-url').href;
    navigator.clipboard.writeText(url);
    showToast('URL copied!', 'success');
  }

  function clearForm() {
    if (confirm('Clear all form data?')) {
      document.getElementById('property-form').reset();
      uploadedPhotos = [];
      realtorPhoto = null;
      loanOfficerPhoto = null;
      renderPhotoPreview();
      document.getElementById('realtor-avatar').innerHTML = '<span>👤</span><input type="file" accept="image/*" id="realtor-photo-input">';
      document.getElementById('lo-avatar').innerHTML = '<span>👤</span><input type="file" accept="image/*" id="lo-photo-input">';
      setupContactPhotoUploads();
      showToast('Form cleared', 'info');
    }
  }

  function showToast(message, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
      toast.remove();
    }, 3000);
  }
})();
