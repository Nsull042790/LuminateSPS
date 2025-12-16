// Property Generator Module JavaScript
(function() {
  var uploadedPhotos = [];
  var realtorPhoto = null;
  var loanOfficerPhoto = null;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Property Generator v2.0 initialized');
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
      uploadFileToHubSpot(files[i], function(url) {
        uploadedPhotos.push({
          url: url,
          label: ''
        });
        renderPhotoPreview();
      });
    }
  }

  function uploadFileToHubSpot(file, callback) {
    // Use HubSpot File Manager API
    var formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify({
      access: 'PUBLIC_INDEXABLE',
      overwrite: false
    }));
    formData.append('folderPath', '/property-generator');

    // Show loading toast
    showToast('Uploading ' + file.name + '...', 'info');

    fetch('/_hcms/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.url) {
        showToast('Photo uploaded!', 'success');
        callback(data.url);
      } else {
        showToast('Upload failed', 'error');
      }
    })
    .catch(function(err) {
      console.error('Upload error:', err);
      showToast('Upload failed', 'error');
    });
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

    // Add remove handlers
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
        uploadFileToHubSpot(file, function(url) {
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

    if (generateBtn) {
      generateBtn.addEventListener('click', generateSite);
    }
    if (previewBtn) {
      previewBtn.addEventListener('click', previewSite);
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', clearForm);
    }

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
        address: form.querySelector('[name="address"]').value,
        city: form.querySelector('[name="city"]').value,
        state: form.querySelector('[name="state"]').value,
        zip: form.querySelector('[name="zip"]').value,
        price: parseFloat((form.querySelector('[name="price"]').value || '').replace(/[$,]/g, '')) || 0,
        bedrooms: parseInt(form.querySelector('[name="bedrooms"]').value) || 0,
        bathrooms: form.querySelector('[name="bathrooms"]').value || '',
        sqft: parseFloat((form.querySelector('[name="sqft"]').value || '').replace(/,/g, '')) || 0,
        yearBuilt: parseInt(form.querySelector('[name="yearBuilt"]').value) || 0,
        mlsNumber: form.querySelector('[name="mlsNumber"]').value || '',
        description: form.querySelector('[name="description"]').value || '',
        features: form.querySelector('[name="features"]').value || ''
      },
      realtor: {
        name: form.querySelector('[name="realtorName"]').value,
        title: form.querySelector('[name="realtorTitle"]').value || 'Licensed Realtor',
        company: form.querySelector('[name="realtorCompany"]').value || '',
        phone: form.querySelector('[name="realtorPhone"]').value || '',
        email: form.querySelector('[name="realtorEmail"]').value || '',
        license: form.querySelector('[name="realtorLicense"]').value || '',
        photo: realtorPhoto
      },
      loanOfficer: {
        name: form.querySelector('[name="loName"]').value,
        title: form.querySelector('[name="loTitle"]').value || 'Loan Officer',
        company: form.querySelector('[name="loCompany"]').value || '',
        phone: form.querySelector('[name="loPhone"]').value || '',
        email: form.querySelector('[name="loEmail"]').value || '',
        nmls: form.querySelector('[name="loNmls"]').value || '',
        photo: loanOfficerPhoto
      },
      photos: uploadedPhotos,
      showNeighborhood: document.getElementById('show-neighborhood').checked,
      neighborhood: {
        walkScore: parseInt(form.querySelector('[name="walkScore"]').value) || 0,
        transitScore: parseInt(form.querySelector('[name="transitScore"]').value) || 0,
        bikeScore: parseInt(form.querySelector('[name="bikeScore"]').value) || 0,
        amenities: form.querySelector('[name="amenities"]').value || ''
      }
    };
    return data;
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

    // Generate HTML
    var html = generatePropertyHTML(data);

    // Create as HubSpot landing page via API
    var slug = slugify(data.property.address + '-' + data.property.city);

    createHubSpotPage(slug, data.property.address, html, function(pageUrl) {
      btn.disabled = false;
      btn.textContent = '🚀 Generate & Publish';

      if (pageUrl) {
        document.getElementById('success-url').textContent = pageUrl;
        document.getElementById('success-url').href = pageUrl;
        document.getElementById('success-modal').classList.add('active');
        loadExistingSites();
      }
    });
  }

  function previewSite() {
    var data = getFormData();
    var html = generatePropertyHTML(data);

    var iframe = document.getElementById('preview-iframe');
    iframe.srcdoc = html;
    document.getElementById('preview-modal').classList.add('active');
  }

  function createHubSpotPage(slug, title, html, callback) {
    // Use HubSpot CMS API to create a landing page
    fetch('/_hcms/api/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: title,
        slug: 'properties/' + slug,
        html_content: html,
        template_path: '@hubspot/landing_page_default.html'
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.url) {
        showToast('Site published!', 'success');
        callback(data.url);
      } else {
        showToast('Error creating page', 'error');
        callback(null);
      }
    })
    .catch(function(err) {
      console.error('Create page error:', err);
      showToast('Error creating page', 'error');
      callback(null);
    });
  }

  function generatePropertyHTML(data) {
    var p = data.property;
    var r = data.realtor;
    var lo = data.loanOfficer;
    var photos = data.photos;

    var featuresHtml = '';
    if (p.features) {
      var featuresList = p.features.split(',');
      featuresHtml = '<ul class="features-list">';
      for (var i = 0; i < featuresList.length; i++) {
        featuresHtml += '<li>✓ ' + featuresList[i].trim() + '</li>';
      }
      featuresHtml += '</ul>';
    }

    var galleryHtml = '';
    for (var j = 0; j < photos.length; j++) {
      galleryHtml += '<div class="gallery-item"><img src="' + photos[j].url + '" alt="Property Photo"></div>';
    }

    var html = '<!DOCTYPE html><html lang="en"><head>';
    html += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
    html += '<title>' + p.address + ', ' + p.city + ', ' + p.state + '</title>';
    html += '<style>';
    html += '* { margin: 0; padding: 0; box-sizing: border-box; }';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #333; }';
    html += '.hero { position: relative; height: 70vh; background: url("' + (photos[0] ? photos[0].url : '') + '") center/cover; }';
    html += '.hero-overlay { position: absolute; inset: 0; background: linear-gradient(transparent 50%, rgba(0,0,0,0.8)); display: flex; align-items: flex-end; padding: 40px; }';
    html += '.hero-content { color: white; max-width: 800px; }';
    html += '.hero h1 { font-size: 2.5em; margin-bottom: 10px; }';
    html += '.hero .price { font-size: 2em; color: #667eea; font-weight: bold; }';
    html += '.stats { display: flex; gap: 30px; margin-top: 20px; }';
    html += '.stat { text-align: center; }';
    html += '.stat-value { font-size: 1.5em; font-weight: bold; }';
    html += '.section { padding: 60px 40px; max-width: 1200px; margin: 0 auto; }';
    html += '.section-title { font-size: 1.8em; color: #0d173c; margin-bottom: 30px; }';
    html += '.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }';
    html += '.gallery-item img { width: 100%; height: 250px; object-fit: cover; border-radius: 8px; }';
    html += '.features-list { columns: 2; list-style: none; }';
    html += '.features-list li { padding: 8px 0; }';
    html += '.contacts { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }';
    html += '.contact-card { background: #f7fafc; border-radius: 12px; padding: 30px; display: flex; gap: 20px; align-items: center; }';
    html += '.contact-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }';
    html += '.contact-photo-placeholder { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 2em; }';
    html += '.contact-info h3 { color: #0d173c; margin-bottom: 5px; }';
    html += '.contact-info p { color: #718096; font-size: 0.9em; margin: 2px 0; }';
    html += '.contact-info a { color: #667eea; text-decoration: none; }';
    html += '.footer { background: #0d173c; color: white; padding: 40px; text-align: center; }';
    html += '</style></head><body>';

    // Hero
    html += '<section class="hero"><div class="hero-overlay"><div class="hero-content">';
    html += '<h1>' + p.address + '</h1>';
    html += '<p>' + p.city + ', ' + p.state + ' ' + p.zip + '</p>';
    html += '<div class="price">$' + p.price.toLocaleString() + '</div>';
    html += '<div class="stats">';
    if (p.bedrooms) html += '<div class="stat"><div class="stat-value">' + p.bedrooms + '</div><div>Beds</div></div>';
    if (p.bathrooms) html += '<div class="stat"><div class="stat-value">' + p.bathrooms + '</div><div>Baths</div></div>';
    if (p.sqft) html += '<div class="stat"><div class="stat-value">' + p.sqft.toLocaleString() + '</div><div>Sq Ft</div></div>';
    html += '</div></div></div></section>';

    // Gallery
    if (photos.length > 0) {
      html += '<section class="section"><h2 class="section-title">Photo Gallery</h2>';
      html += '<div class="gallery">' + galleryHtml + '</div></section>';
    }

    // Description & Features
    if (p.description || p.features) {
      html += '<section class="section">';
      if (p.description) {
        html += '<h2 class="section-title">About This Property</h2>';
        html += '<p>' + p.description + '</p>';
      }
      if (featuresHtml) {
        html += '<h2 class="section-title" style="margin-top:40px;">Features</h2>';
        html += featuresHtml;
      }
      html += '</section>';
    }

    // Contacts
    html += '<section class="section"><h2 class="section-title">Contact Us</h2><div class="contacts">';

    // Realtor Card
    html += '<div class="contact-card">';
    if (r.photo) {
      html += '<img src="' + r.photo + '" alt="' + r.name + '" class="contact-photo">';
    } else {
      html += '<div class="contact-photo-placeholder">👤</div>';
    }
    html += '<div class="contact-info">';
    html += '<h3>' + r.name + '</h3>';
    html += '<p>' + r.title + '</p>';
    if (r.company) html += '<p>' + r.company + '</p>';
    if (r.phone) html += '<p><a href="tel:' + r.phone + '">' + r.phone + '</a></p>';
    if (r.email) html += '<p><a href="mailto:' + r.email + '">' + r.email + '</a></p>';
    if (r.license) html += '<p style="font-size:0.8em;">' + r.license + '</p>';
    html += '</div></div>';

    // Loan Officer Card
    html += '<div class="contact-card">';
    if (lo.photo) {
      html += '<img src="' + lo.photo + '" alt="' + lo.name + '" class="contact-photo">';
    } else {
      html += '<div class="contact-photo-placeholder" style="background:linear-gradient(135deg,#11998e,#38ef7d);">👤</div>';
    }
    html += '<div class="contact-info">';
    html += '<h3>' + lo.name + '</h3>';
    html += '<p>' + lo.title + '</p>';
    if (lo.company) html += '<p>' + lo.company + '</p>';
    if (lo.phone) html += '<p><a href="tel:' + lo.phone + '">' + lo.phone + '</a></p>';
    if (lo.email) html += '<p><a href="mailto:' + lo.email + '">' + lo.email + '</a></p>';
    if (lo.nmls) html += '<p style="font-size:0.8em;">NMLS# ' + lo.nmls + '</p>';
    html += '</div></div>';

    html += '</div></section>';

    // Footer
    html += '<footer class="footer">';
    html += '<p>© ' + new Date().getFullYear() + ' ' + r.company + ' & ' + lo.company + '</p>';
    html += '<p style="margin-top:10px;font-size:0.8em;opacity:0.7;">Equal Housing Opportunity</p>';
    html += '</footer>';

    html += '</body></html>';
    return html;
  }

  function slugify(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function loadExistingSites() {
    // Load from HubSpot - would need API integration
    var list = document.getElementById('sites-list');
    if (list) {
      list.innerHTML = '<p class="no-sites">No sites generated yet</p>';
    }
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
