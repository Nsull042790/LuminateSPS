// Property Generator Module JavaScript v4.7 - HubDB Version
// Uses HubDB for data storage with dynamic pages
(function() {
  var uploadedPhotos = [];
  var realtorPhoto = null;
  var realtorLogo = null;
  var loanOfficerPhoto = null;
  var draggedPhotoIndex = null;
  var fileDialogOpen = false; // Prevent multiple file dialogs

  // LO Company Logo - always Luminate Bank
  var LO_COMPANY_LOGO = 'https://lirp.cdn-website.com/e49062f7/dms3rep/multi/opt/LuminateBank_SecondaryLogo_Color-1920w.png';

  // User context - populated from HubL in module.html
  var currentUserEmail = '';
  var currentUserName = '';

  // Serverless function endpoints - explicitly use fresh.functions folder
  var API_BASE = '/_hcms/api/fresh';

  // Safe file input trigger - prevents multiple dialogs
  var lastFileDialogTime = 0;
  function triggerFileInput(input) {
    var now = Date.now();
    // Prevent triggers within 1.5 seconds of each other
    if (fileDialogOpen || (now - lastFileDialogTime) < 1500) {
      console.log('Blocked duplicate file dialog');
      return;
    }
    fileDialogOpen = true;
    lastFileDialogTime = now;

    // Small delay before clicking to let any pending events settle
    setTimeout(function() {
      input.click();
    }, 50);

    // Reset flag after dialog closes (longer timeout)
    setTimeout(function() {
      fileDialogOpen = false;
    }, 2000);
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Property Generator v4.7 (HubDB) initialized');

    // Check for URL query parameters first (from HubSpot CRM integration)
    var urlParams = new URLSearchParams(window.location.search);
    var urlEmail = urlParams.get('email');
    var urlName = urlParams.get('name');

    // Debug: log what we received
    console.log('URL params - email:', urlEmail, 'name:', urlName);

    // Get user context from URL params or data attributes
    var container = document.getElementById('property-generator');
    if (urlEmail) {
      // From HubSpot CRM card - use URL params
      currentUserEmail = urlEmail;
      currentUserName = urlName || '';
      console.log('User from HubSpot:', currentUserEmail, currentUserName);
    } else if (container) {
      // From HubL context - use data attributes
      currentUserEmail = container.getAttribute('data-user-email') || '';
      currentUserName = container.getAttribute('data-user-name') || '';
      console.log('User from HubL:', currentUserEmail, currentUserName);
    }

    // Update user info display if present
    updateUserInfoDisplay();

    // Pre-fill LO info from HubSpot user
    prefillLoanOfficerInfo();

    setupPhotoUpload();
    setupContactPhotoUploads();
    setupRealtorLogoUpload();
    setupFormHandlers();
    setupModalHandlers();
    setupNeighborhoodToggle();
    loadExistingProperties();
  });

  function prefillLoanOfficerInfo() {
    var loNameInput = document.getElementById('lo-name-input');
    var loEmailInput = document.getElementById('lo-email-input');
    var loPhoneInput = document.querySelector('input[name="loPhone"]');
    var loNmlsInput = document.querySelector('input[name="loNmls"]');
    var loTitleInput = document.querySelector('input[name="loTitle"]');

    // Load saved LO profile from localStorage first
    var savedProfile = null;
    if (currentUserEmail) {
      var saved = localStorage.getItem('lo_profile_' + currentUserEmail);
      if (saved) {
        try {
          savedProfile = JSON.parse(saved);
        } catch (e) {
          console.log('Could not parse LO profile');
        }
      }
    }

    // Pre-fill LO name - priority: HubSpot context > localStorage > empty
    if (loNameInput) {
      if (currentUserName) {
        loNameInput.value = currentUserName;
        console.log('Set LO name from HubSpot:', currentUserName);
      } else if (savedProfile && savedProfile.name && !loNameInput.value) {
        loNameInput.value = savedProfile.name;
        console.log('Set LO name from localStorage:', savedProfile.name);
      }
    }

    // Pre-fill LO email
    if (loEmailInput) {
      if (currentUserEmail) {
        loEmailInput.value = currentUserEmail;
      }
    }

    // Fill other fields from localStorage
    if (savedProfile) {
      if (loPhoneInput && !loPhoneInput.value && savedProfile.phone) {
        loPhoneInput.value = savedProfile.phone;
      }
      if (loNmlsInput && !loNmlsInput.value && savedProfile.nmls) {
        loNmlsInput.value = savedProfile.nmls;
      }
      if (loTitleInput && savedProfile.title) {
        loTitleInput.value = savedProfile.title;
      }
    }

    // Setup saving for all LO fields
    if (currentUserEmail) {
      setupLOProfileSaving();
    }
  }

  function setupLOProfileSaving() {
    var loNameInput = document.getElementById('lo-name-input');
    var loPhoneInput = document.querySelector('input[name="loPhone"]');
    var loNmlsInput = document.querySelector('input[name="loNmls"]');
    var loTitleInput = document.querySelector('input[name="loTitle"]');

    function saveLOProfile() {
      if (!currentUserEmail) return;
      var profile = {
        name: loNameInput ? loNameInput.value : '',
        phone: loPhoneInput ? loPhoneInput.value : '',
        nmls: loNmlsInput ? loNmlsInput.value : '',
        title: loTitleInput ? loTitleInput.value : ''
      };
      localStorage.setItem('lo_profile_' + currentUserEmail, JSON.stringify(profile));
      console.log('Saved LO profile:', profile);
    }

    if (loNameInput) loNameInput.addEventListener('blur', saveLOProfile);
    if (loPhoneInput) loPhoneInput.addEventListener('blur', saveLOProfile);
    if (loNmlsInput) loNmlsInput.addEventListener('blur', saveLOProfile);
    if (loTitleInput) loTitleInput.addEventListener('blur', saveLOProfile);
  }

  function setupRealtorLogoUpload() {
    var logoArea = document.getElementById('realtor-logo-area');
    var logoInput = document.getElementById('realtor-logo-input');
    var logoPreview = document.getElementById('realtor-logo-preview');

    if (!logoArea || !logoInput) return;

    // Prevent duplicate event listeners
    if (logoArea.hasAttribute('data-listener-attached')) return;
    logoArea.setAttribute('data-listener-attached', 'true');

    logoArea.addEventListener('click', function(e) {
      e.stopPropagation();
      triggerFileInput(logoInput);
    });

    logoInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        uploadFile(file, function(url) {
          realtorLogo = url;
          logoPreview.innerHTML = '<img src="' + url + '" alt="Company Logo">';
          showToast('Logo uploaded!', 'success');
        });
      }
    });
  }

  function updateUserInfoDisplay() {
    // Update the user info display in the header if present
    var userInfo = document.querySelector('.pg-user-info');
    var userWarning = document.querySelector('.pg-user-warning');

    if (currentUserEmail) {
      if (userInfo) {
        userInfo.textContent = 'Logged in as: ' + currentUserEmail;
        userInfo.style.display = 'block';
      }
      if (userWarning) {
        userWarning.style.display = 'none';
      }
    } else {
      if (userInfo) {
        userInfo.style.display = 'none';
      }
      if (userWarning) {
        userWarning.textContent = 'Not logged in - Please access via HubSpot';
        userWarning.style.display = 'block';
      }
    }
  }

  // Photo Upload Setup
  function setupPhotoUpload() {
    var uploadArea = document.getElementById('photo-upload-area');
    var photoInput = document.getElementById('photo-input');

    if (!uploadArea || !photoInput) return;

    // Prevent duplicate event listeners
    if (uploadArea.hasAttribute('data-listener-attached')) return;
    uploadArea.setAttribute('data-listener-attached', 'true');

    uploadArea.addEventListener('click', function(e) {
      e.stopPropagation();
      triggerFileInput(photoInput);
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
        uploadedPhotos.push(url);
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

      fetch(API_BASE + '/uploadfile', {
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
      var photoUrl = uploadedPhotos[i];
      var isHero = (i === 0);
      html += '<div class="pg-photo-item' + (isHero ? ' hero-photo' : '') + '" draggable="true" data-index="' + i + '">';
      if (isHero) {
        html += '<span class="hero-badge">HERO</span>';
      }
      html += '<span class="photo-number">' + (i + 1) + '</span>';
      html += '<img src="' + photoUrl + '" alt="Photo ' + (i + 1) + '">';
      html += '<div class="photo-actions">';
      html += '<button type="button" class="move-btn move-left" data-index="' + i + '" title="Move left">&larr;</button>';
      html += '<button type="button" class="move-btn move-right" data-index="' + i + '" title="Move right">&rarr;</button>';
      html += '<button type="button" class="remove-btn" data-index="' + i + '" title="Remove">&times;</button>';
      html += '</div>';
      html += '</div>';
    }
    grid.innerHTML = html;

    // Setup drag and drop
    var photoItems = grid.querySelectorAll('.pg-photo-item');
    photoItems.forEach(function(item) {
      item.addEventListener('dragstart', function(e) {
        draggedPhotoIndex = parseInt(this.getAttribute('data-index'));
        this.classList.add('dragging');
      });

      item.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        draggedPhotoIndex = null;
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
      });

      item.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        var dropIndex = parseInt(this.getAttribute('data-index'));
        if (draggedPhotoIndex !== null && draggedPhotoIndex !== dropIndex) {
          // Reorder the array
          var draggedPhoto = uploadedPhotos[draggedPhotoIndex];
          uploadedPhotos.splice(draggedPhotoIndex, 1);
          uploadedPhotos.splice(dropIndex, 0, draggedPhoto);
          renderPhotoPreview();
          showToast('Photos reordered', 'success');
        }
      });
    });

    // Move left/right buttons
    grid.querySelectorAll('.move-left').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var index = parseInt(this.getAttribute('data-index'));
        if (index > 0) {
          var temp = uploadedPhotos[index];
          uploadedPhotos[index] = uploadedPhotos[index - 1];
          uploadedPhotos[index - 1] = temp;
          renderPhotoPreview();
        }
      });
    });

    grid.querySelectorAll('.move-right').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var index = parseInt(this.getAttribute('data-index'));
        if (index < uploadedPhotos.length - 1) {
          var temp = uploadedPhotos[index];
          uploadedPhotos[index] = uploadedPhotos[index + 1];
          uploadedPhotos[index + 1] = temp;
          renderPhotoPreview();
        }
      });
    });

    // Remove buttons
    grid.querySelectorAll('.remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var index = parseInt(this.getAttribute('data-index'));
        uploadedPhotos.splice(index, 1);
        renderPhotoPreview();
      });
    });
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

    // Prevent duplicate event listeners
    if (avatar.hasAttribute('data-listener-attached')) return;
    avatar.setAttribute('data-listener-attached', 'true');

    avatar.addEventListener('click', function(e) {
      e.stopPropagation();
      triggerFileInput(input);
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

    if (generateBtn) generateBtn.addEventListener('click', generateProperty);
    if (previewBtn) previewBtn.addEventListener('click', previewProperty);
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
      generateProperty();
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
        photo: realtorPhoto,
        logo: realtorLogo
      },
      loanOfficer: {
        name: getValue('loName'),
        title: getValue('loTitle') || 'Loan Officer',
        company: getValue('loCompany') || 'Luminate Bank',
        phone: getValue('loPhone') || '',
        email: getValue('loEmail') || '',
        nmls: getValue('loNmls') || '',
        photo: loanOfficerPhoto,
        logo: LO_COMPANY_LOGO
      },
      photos: uploadedPhotos,
      showNeighborhood: document.getElementById('show-neighborhood') ? document.getElementById('show-neighborhood').checked : false,
      neighborhood: {
        walkScore: parseInt(getValue('walkScore')) || 0,
        transitScore: parseInt(getValue('transitScore')) || 0,
        bikeScore: parseInt(getValue('bikeScore')) || 0,
        amenities: getValue('amenities') || ''
      },
      userEmail: currentUserEmail,
      userName: currentUserName
    };
    return data;

    function getValue(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? el.value : '';
    }
  }

  function generateProperty() {
    var data = getFormData();

    if (!data.property.address || !data.realtor.name || !data.loanOfficer.name) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    if (!currentUserEmail) {
      showToast('User authentication required. Please log in.', 'error');
      return;
    }

    var btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    // Send data to HubDB via serverless function
    fetch(API_BASE + '/createprop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      btn.disabled = false;
      btn.textContent = 'Create Property Site';

      if (result.success && result.slug) {
        // Build URL from slug - adjust domain as needed for your HubSpot portal
        var propertyUrl = '/properties-1/' + result.slug;
        document.getElementById('success-url').textContent = propertyUrl;
        document.getElementById('success-url').href = propertyUrl;
        document.getElementById('success-modal').classList.add('active');
        loadExistingProperties();
        showToast('Property site created!', 'success');
      } else {
        showToast('Error: ' + (result.error || 'Could not create property'), 'error');
      }
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'Create Property Site';
      showToast('Error creating property', 'error');
      console.error(err);
    });
  }

  function previewProperty() {
    var data = getFormData();

    if (!data.property.address) {
      showToast('Please enter a property address', 'error');
      return;
    }

    // Generate preview HTML
    var html = generatePreviewHTML(data);
    var iframe = document.getElementById('preview-iframe');
    iframe.srcdoc = html;
    document.getElementById('preview-modal').classList.add('active');
  }

  function generatePreviewHTML(data) {
    var p = data.property;
    var r = data.realtor;
    var lo = data.loanOfficer;
    var photos = data.photos;

    var heroImage = photos.length > 0 ? photos[0] : '';

    // Features list
    var featuresHtml = '';
    if (p.features) {
      var featuresList = p.features.split(',');
      featuresHtml = '<ul class="features-list">';
      for (var i = 0; i < featuresList.length; i++) {
        var f = featuresList[i].trim();
        if (f) featuresHtml += '<li>&#10003; ' + f + '</li>';
      }
      featuresHtml += '</ul>';
    }

    // Gallery HTML
    var galleryHtml = '';
    for (var j = 0; j < photos.length; j++) {
      galleryHtml += '<div class="gallery-item"><img src="' + photos[j] + '" alt="Photo ' + (j+1) + '"></div>';
    }

    var html = '<!DOCTYPE html><html><head>';
    html += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
    html += '<title>' + p.address + ', ' + p.city + '</title>';
    html += '<link rel="preconnect" href="https://fonts.googleapis.com">';
    html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;500;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet">';
    html += '<style>';
    html += '* { margin: 0; padding: 0; box-sizing: border-box; }';
    html += 'body { font-family: "Josefin Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #333; }';
    html += 'h1, h2, h3 { font-family: "Poppins", sans-serif; font-weight: 700; }';
    html += '.hero { position: relative; height: 70vh; background: url("' + heroImage + '") center/cover; }';
    html += '.hero-overlay { position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgba(13,23,60,0.9)); display: flex; align-items: flex-end; padding: 40px; }';
    html += '.hero-content { color: white; max-width: 900px; }';
    html += '.hero h1 { font-size: 2.8em; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }';
    html += '.hero .location { font-size: 1.2em; opacity: 0.9; }';
    html += '.hero .price { font-size: 2.5em; color: #96daf8; font-weight: bold; margin-top: 15px; }';
    html += '.stats { display: flex; gap: 40px; margin-top: 25px; }';
    html += '.stat { text-align: center; }';
    html += '.stat-value { font-size: 1.8em; font-weight: bold; }';
    html += '.stat-label { font-size: 0.9em; opacity: 0.8; }';
    html += '.section { padding: 60px 40px; max-width: 1200px; margin: 0 auto; }';
    html += '.section-dark { background: #f7fafc; }';
    html += '.section-title { font-size: 2em; color: #0d173c; margin-bottom: 30px; display: flex; align-items: center; gap: 15px; }';
    html += '.section-title:before { content: ""; display: block; width: 5px; height: 35px; background: linear-gradient(135deg, #0d173c, #96daf8); border-radius: 3px; }';
    html += '.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }';
    html += '.gallery-item { overflow: hidden; border-radius: 12px; }';
    html += '.gallery-item img { width: 100%; height: 250px; object-fit: cover; }';
    html += '.description { font-size: 1.1em; line-height: 1.8; color: #4a5568; }';
    html += '.features-list { columns: 2; list-style: none; margin-top: 20px; }';
    html += '.features-list li { padding: 10px 0; font-size: 1.05em; }';
    html += '.contacts { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; }';
    html += '.contact-card { background: white; border-radius: 16px; padding: 30px; display: flex; gap: 25px; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }';
    html += '.contact-photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #96daf8; }';
    html += '.contact-placeholder { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #0d173c, #96daf8); display: flex; align-items: center; justify-content: center; font-size: 2.5em; color: white; }';
    html += '.contact-placeholder.lo { background: linear-gradient(135deg, #11998e, #38ef7d); }';
    html += '.contact-info h3 { color: #0d173c; font-size: 1.3em; margin-bottom: 5px; }';
    html += '.contact-info .title { color: #0d173c; font-weight: 600; margin-bottom: 10px; }';
    html += '.contact-info p { color: #718096; font-size: 0.95em; margin: 5px 0; }';
    html += '.calculator { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 500px; }';
    html += '.calc-input { display: flex; flex-direction: column; margin-bottom: 20px; }';
    html += '.calc-input label { font-weight: 600; margin-bottom: 8px; color: #4a5568; }';
    html += '.calc-input input { padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1em; }';
    html += '.calc-result { background: linear-gradient(135deg, #0d173c, #1a2a5e); color: white; padding: 25px; border-radius: 12px; text-align: center; margin-top: 20px; }';
    html += '.calc-result .amount { font-size: 2.5em; font-weight: bold; color: #96daf8; }';
    html += '.calc-result .label { opacity: 0.9; margin-top: 5px; }';
    html += '.footer { background: #0d173c; color: white; padding: 40px; text-align: center; }';
    html += '.footer p { margin: 5px 0; }';
    html += '.footer .disclaimer { font-size: 0.85em; opacity: 0.7; margin-top: 20px; }';
    html += '.preview-banner { background: #0d173c; color: #96daf8; padding: 12px; text-align: center; font-weight: bold; position: sticky; top: 0; z-index: 100; }';
    html += '</style></head><body>';

    html += '<div class="preview-banner">PREVIEW - This is how your property site will look</div>';

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
      html += '<img src="' + r.photo + '" class="contact-photo">';
    } else {
      html += '<div class="contact-placeholder">&#128100;</div>';
    }
    html += '<div class="contact-info"><h3>' + r.name + '</h3><p class="title">' + r.title + '</p>';
    if (r.company) html += '<p>' + r.company + '</p>';
    if (r.phone) html += '<p>&#128222; ' + r.phone + '</p>';
    if (r.email) html += '<p>&#9993; ' + r.email + '</p>';
    if (r.license) html += '<p style="font-size:0.85em;color:#a0aec0;">' + r.license + '</p>';
    if (r.logo) html += '<img src="' + r.logo + '" class="company-logo" style="max-width:120px;max-height:40px;margin-top:10px;object-fit:contain;">';
    html += '</div></div>';

    // Loan Officer Card
    html += '<div class="contact-card">';
    if (lo.photo) {
      html += '<img src="' + lo.photo + '" class="contact-photo" style="border-color:#11998e;">';
    } else {
      html += '<div class="contact-placeholder lo">&#128100;</div>';
    }
    html += '<div class="contact-info"><h3>' + lo.name + '</h3><p class="title" style="color:#11998e;">' + lo.title + '</p>';
    if (lo.company) html += '<p>' + lo.company + '</p>';
    if (lo.phone) html += '<p>&#128222; ' + lo.phone + '</p>';
    if (lo.email) html += '<p>&#9993; ' + lo.email + '</p>';
    if (lo.nmls) html += '<p style="font-size:0.85em;color:#a0aec0;">NMLS# ' + lo.nmls + '</p>';
    if (lo.logo) html += '<img src="' + lo.logo + '" class="company-logo" style="max-width:120px;max-height:40px;margin-top:10px;object-fit:contain;">';
    html += '</div></div></div></section>';

    // Footer
    html += '<footer class="footer">';
    html += '<p>&copy; ' + new Date().getFullYear() + ' ' + (r.company || 'Real Estate') + ' & ' + (lo.company || 'Mortgage Services') + '</p>';
    if (p.mlsNumber) html += '<p style="margin-top:10px;">MLS# ' + p.mlsNumber + '</p>';
    html += '<p class="disclaimer">Equal Housing Opportunity. This is not a commitment to lend.</p>';
    html += '</footer>';

    // Calculator Script
    html += '<script>';
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
    html += '</script></body></html>';

    return html;
  }

  function loadExistingProperties() {
    // Only load if user is logged in
    if (!currentUserEmail) {
      var list = document.getElementById('sites-list');
      if (list) {
        list.innerHTML = '<p class="no-sites">Please log in to see your properties</p>';
      }
      return;
    }

    fetch(API_BASE + '/listprops?email=' + encodeURIComponent(currentUserEmail))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var list = document.getElementById('sites-list');
        if (!list) return;

        if (data.success && data.properties && data.properties.length > 0) {
          var html = '';
          for (var i = 0; i < data.properties.length; i++) {
            var prop = data.properties[i];
            // HubDB rows have values in a nested 'values' object
            var vals = prop.values || prop;
            var propUrl = '/properties-1/' + (vals.slug || '');
            var propName = vals.name || vals.address || 'Property';
            var propPrice = vals.price || 0;
            html += '<div class="site-item" data-id="' + prop.id + '">';
            html += '<div class="site-info">';
            html += '<a href="' + propUrl + '" target="_blank" class="site-name">' + propName + '</a>';
            html += '<span class="site-price">$' + propPrice.toLocaleString() + '</span>';
            html += '</div>';
            html += '<div class="actions">';
            html += '<button type="button" class="copy-site-url" data-url="' + propUrl + '" title="Copy URL">&#128203;</button>';
            html += '<button type="button" class="delete-site" data-id="' + prop.id + '" title="Delete">&#128465;</button>';
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
              var rowId = this.getAttribute('data-id');
              // Direct delete - confirm() doesn't work in sandboxed iframes
              deleteProperty(rowId);
            });
          });
        } else {
          list.innerHTML = '<p class="no-sites">No properties created yet</p>';
        }
      })
      .catch(function(err) {
        console.error('Error loading properties:', err);
      });
  }

  function deleteProperty(rowId) {
    fetch(API_BASE + '/deleteprop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: rowId,
        userEmail: currentUserEmail
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        showToast('Property deleted', 'success');
        loadExistingProperties();
      } else {
        showToast('Error: ' + (data.error || 'Could not delete'), 'error');
      }
    })
    .catch(function(err) {
      showToast('Error deleting property', 'error');
    });
  }

  function closePreviewModal() {
    document.getElementById('preview-modal').classList.remove('active');
  }

  function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
  }

  function copyUrl() {
    var urlElement = document.getElementById('success-url');
    var url = urlElement.href;

    // Try modern clipboard API first, then fallback for sandboxed iframes
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() {
        showToast('URL copied!', 'success');
      }).catch(function() {
        // Fallback for sandboxed iframes
        fallbackCopy(url);
      });
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    // Create a temporary input element
    var tempInput = document.createElement('input');
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    tempInput.setSelectionRange(0, 99999); // For mobile

    try {
      var success = document.execCommand('copy');
      if (success) {
        showToast('URL copied!', 'success');
      } else {
        // If copy still fails, show the URL for manual copy
        showToast('Copy failed - URL: ' + text, 'info');
      }
    } catch (err) {
      showToast('Copy failed - URL: ' + text, 'info');
    }

    document.body.removeChild(tempInput);
  }

  function clearForm() {
    // Direct clear - confirm() doesn't work in sandboxed iframes
    document.getElementById('property-form').reset();
    uploadedPhotos = [];
    realtorPhoto = null;
    realtorLogo = null;
    loanOfficerPhoto = null;
    renderPhotoPreview();

    // Reset avatar elements and remove listener flags so they can be reattached
    var realtorAvatar = document.getElementById('realtor-avatar');
    var loAvatar = document.getElementById('lo-avatar');
    var logoArea = document.getElementById('realtor-logo-area');

    if (realtorAvatar) {
      realtorAvatar.removeAttribute('data-listener-attached');
      realtorAvatar.innerHTML = '<span>&#128100;</span><input type="file" accept="image/*" id="realtor-photo-input" hidden>';
    }
    if (loAvatar) {
      loAvatar.removeAttribute('data-listener-attached');
      loAvatar.innerHTML = '<span>&#128100;</span><input type="file" accept="image/*" id="lo-photo-input" hidden>';
    }
    if (logoArea) {
      logoArea.removeAttribute('data-listener-attached');
      document.getElementById('realtor-logo-preview').innerHTML = '<span class="logo-placeholder">Click to upload company logo</span>';
    }

    setupContactPhotoUploads();
    setupRealtorLogoUpload();
    // Re-fill LO info from user context
    prefillLoanOfficerInfo();
    showToast('Form cleared', 'info');
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
