// Property Generator Module JavaScript v8.3 - HubDB Version
// Uses HubDB for data storage with dynamic pages
// Fixed: Proper aspect ratio for all images, embedded Luminate logo for compliance
(function() {
  var uploadedPhotos = [];
  var realtorPhoto = null;
  var realtorLogo = null;
  var loanOfficerPhoto = null;
  var draggedPhotoIndex = null;
  var fileDialogOpen = false; // Prevent multiple file dialogs

  // Edit mode tracking
  var editMode = false;
  var currentEditRowId = null;
  var currentEditSlug = null;

  // Submission tracking to prevent double-clicks
  var isSubmitting = false;
  var pendingDeleteId = null;

  // LO Company Logo - always Luminate Bank
  var LO_COMPANY_LOGO = 'https://lirp.cdn-website.com/e49062f7/dms3rep/multi/opt/LuminateBank_SecondaryLogo_Color-1920w.png';

  // User context - populated from HubL in module.html
  var currentUserEmail = '';
  var currentUserName = '';

  // Serverless function endpoints
  var API_BASE = '/_hcms/api';

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
    console.log('Property Generator v8.3 (HubDB) initialized');

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
        html += '<span class="hero-badge">FEATURED</span>';
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
    var flyerBtn = document.getElementById('flyer-btn');

    if (generateBtn) generateBtn.addEventListener('click', generateProperty);
    if (previewBtn) previewBtn.addEventListener('click', previewProperty);
    if (clearBtn) clearBtn.addEventListener('click', clearForm);
    if (flyerBtn) flyerBtn.addEventListener('click', downloadFlyer);

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

    // Delete confirmation modal handlers
    var deleteCancel = document.getElementById('delete-cancel');
    var deleteConfirmBtn = document.getElementById('delete-confirm');
    if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteModal);
    if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', confirmDelete);
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
        address_2: getValue('address2') || '',
        city: getValue('city'),
        state: getValue('state'),
        zip: getValue('zip'),
        price: parseFloat((getValue('price') || '').replace(/[$,]/g, '')) || 0,
        bedrooms: parseInt(getValue('bedrooms')) || 0,
        bathrooms: getValue('bathrooms') || '',
        sqft: parseFloat((getValue('sqft') || '').replace(/,/g, '')) || 0,
        yearBuilt: parseInt(getValue('yearBuilt')) || 0,
        mlsNumber: getValue('mlsNumber') || '',
        openHouseDate: getValue('openHouseDate') || '',
        openHouseStart: getValue('openHouseStart') || '',
        openHouseEnd: getValue('openHouseEnd') || '',
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
        website: getValue('realtorWebsite') || '',
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
        website: getValue('loWebsite') || '',
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
    // Prevent double-submission
    if (isSubmitting) {
      console.log('Submission already in progress, ignoring click');
      return;
    }

    var data = getFormData();

    if (!data.property.address || !data.realtor.name || !data.loanOfficer.name) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    if (!currentUserEmail) {
      showToast('User authentication required. Please log in.', 'error');
      return;
    }

    isSubmitting = true;
    var btn = document.getElementById('generate-btn');
    btn.disabled = true;

    // Check if we're in edit mode
    if (editMode && currentEditRowId) {
      btn.textContent = 'Updating...';
      data.rowId = currentEditRowId;

      // Send update request
      fetch(API_BASE + '/updateprop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        isSubmitting = false;
        btn.disabled = false;
        updateEditModeUI();

        console.log('updateprop response:', JSON.stringify(result));

        if (result.success) {
          var propertyUrl = '/properties-1/' + (result.slug || currentEditSlug);
          document.getElementById('success-url').textContent = propertyUrl;
          document.getElementById('success-url').href = propertyUrl;
          document.getElementById('success-modal').classList.add('active');
          startShareReadiness(propertyUrl);
          loadExistingProperties();
          showToast('Property updated successfully!', 'success');

          // Exit edit mode after successful update
          cancelEdit(true); // silent cancel
        } else {
          showToast('Error: ' + (result.error || 'Could not update property'), 'error');
        }
      })
      .catch(function(err) {
        isSubmitting = false;
        btn.disabled = false;
        updateEditModeUI();
        showToast('Error updating property', 'error');
        console.error(err);
      });
    } else {
      // Create new property
      btn.textContent = 'Creating...';

      fetch(API_BASE + '/createprop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = 'Create Property Site';

        console.log('createprop response:', JSON.stringify(result));

        if (result.success && result.slug) {
          // Build URL from slug
          var propertyUrl = '/properties-1/' + result.slug;
          document.getElementById('success-url').textContent = propertyUrl;
          document.getElementById('success-url').href = propertyUrl;
          document.getElementById('success-modal').classList.add('active');
          startShareReadiness(propertyUrl);
          loadExistingProperties();

          // Check verification status and show appropriate message
          if (result.verified === true) {
            showToast('Property site created and verified!', 'success');
          } else if (result.warning) {
            showToast('Property created - page may take up to 60 seconds to appear', 'info');
          } else if (result.published === false) {
            showToast('Warning: Property saved but publish may have failed. Check in a minute.', 'error');
          } else {
            showToast('Property site created!', 'success');
          }
        } else {
          showToast('Error: ' + (result.error || 'Could not create property'), 'error');
        }
      })
      .catch(function(err) {
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = 'Create Property Site';
        showToast('Error creating property', 'error');
        console.error(err);
      });
    }
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

  // Download Flyer - Generate professional PDF with photos and logos
  function downloadFlyer() {
    var data = getFormData();

    if (!data.property.address) {
      showToast('Please enter a property address first', 'error');
      return;
    }

    var btn = document.getElementById('flyer-btn');
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
      showToast('PDF library not loaded. Please refresh and try again.', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    // Load images and generate PDF
    var imagesToLoad = [];
    var photos = data.photos || [];

    // Add up to 6 property photos
    for (var i = 0; i < Math.min(6, photos.length); i++) {
      imagesToLoad.push({ key: 'photo' + i, url: photos[i] });
    }

    // Add Luminate Bank logo (white version for dark blue LO card)
    imagesToLoad.push({
      key: 'luminateLogo',
      url: LUMINATE_LOGO_BASE64,
      keepTransparent: true
    });

    // Add FDIC/Equal Housing Lender logo for footer
    imagesToLoad.push({
      key: 'fdicLogo',
      url: FDIC_LOGO_BASE64,
      keepTransparent: true
    });

    // Add realtor logo if available (keep PNG transparency)
    if (data.realtor.logo) {
      console.log('Loading realtor logo:', data.realtor.logo);
      imagesToLoad.push({ key: 'realtorLogo', url: data.realtor.logo, keepTransparent: true });
    }

    // Add contact photos if available
    if (data.realtor.photo) {
      imagesToLoad.push({ key: 'realtorPhoto', url: data.realtor.photo });
    }
    if (data.loanOfficer.photo) {
      imagesToLoad.push({ key: 'loPhoto', url: data.loanOfficer.photo });
    }

    // Load all images then generate PDF
    loadImagesForPDF(imagesToLoad, function(loadedImages) {
      try {
        generateFlyerPDF(data, loadedImages);
        showToast('Flyer downloaded!', 'success');
      } catch (err) {
        console.error('Flyer generation error:', err);
        showToast('Error generating flyer: ' + err.message, 'error');
      }
      btn.disabled = false;
      btn.textContent = originalText;
    });
  }

  // Luminate Bank logo as embedded base64 (for compliance - avoids CORS issues)
  var FDIC_LOGO_BASE64 = 'data:image/png;base64,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';
  var LUMINATE_LOGO_BASE64 = 'data:image/png;base64,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';

  // Helper to load images as base64 for PDF with aspect ratio data
  function loadImagesForPDF(imageList, callback) {
    var loaded = {};
    var remaining = imageList.length;

    if (remaining === 0) {
      callback(loaded);
      return;
    }

    imageList.forEach(function(item) {
      var img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = function() {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          // Keep PNG format for logos to preserve transparency
          var format = item.keepTransparent ? 'image/png' : 'image/jpeg';
          var quality = item.keepTransparent ? undefined : 0.92;
          loaded[item.key] = {
            data: canvas.toDataURL(format, quality),
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height,
            isPng: item.keepTransparent
          };
          console.log('Loaded image:', item.key, img.width, 'x', img.height, item.keepTransparent ? '(PNG)' : '(JPEG)');
        } catch (e) {
          console.log('Could not load image:', item.key, e);
        }
        remaining--;
        if (remaining === 0) callback(loaded);
      };
      img.onerror = function() {
        console.log('Failed to load image:', item.key, item.url);
        remaining--;
        if (remaining === 0) callback(loaded);
      };
      img.src = item.url;
    });

    // Timeout fallback
    setTimeout(function() {
      if (remaining > 0) {
        console.log('Image loading timeout, proceeding with available images');
        callback(loaded);
      }
    }, 5000);
  }

  // Calculate dimensions that fit within a box while maintaining aspect ratio
  function fitImageToBox(imgData, maxWidth, maxHeight) {
    var aspectRatio = imgData.aspectRatio;
    var width = maxWidth;
    var height = maxWidth / aspectRatio;

    // If height exceeds max, scale down based on height
    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }

    return { width: width, height: height };
  }

  // Calculate dimensions to cover a box (crop to fill) while maintaining aspect ratio
  function coverImageToBox(imgData, boxWidth, boxHeight) {
    var aspectRatio = imgData.aspectRatio;
    var boxAspectRatio = boxWidth / boxHeight;

    var width, height, offsetX = 0, offsetY = 0;

    if (aspectRatio > boxAspectRatio) {
      // Image is wider - fit to height, crop width
      height = boxHeight;
      width = boxHeight * aspectRatio;
      offsetX = (width - boxWidth) / 2;
    } else {
      // Image is taller - fit to width, crop height
      width = boxWidth;
      height = boxWidth / aspectRatio;
      offsetY = (height - boxHeight) / 2;
    }

    return { width: boxWidth, height: boxHeight, sourceWidth: width, sourceHeight: height, offsetX: offsetX, offsetY: offsetY };
  }

  // Poll the freshly published page until the CDN serves it, so agents
  // don't share a link that Facebook would scrape (and cache) as a 404
  function startShareReadiness(path) {
    var anchor = document.getElementById('success-url');
    if (!anchor || !anchor.parentNode) return;
    var status = document.getElementById('share-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'share-status';
      status.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:8px;font-size:14px;font-weight:600;line-height:1.4;';
      anchor.parentNode.appendChild(status);
    }
    status.style.background = '#fff6dd';
    status.style.color = '#8a6d1a';
    status.textContent = '⏳ Publishing to the web — hold off on sharing for a moment…';

    var url = window.location.origin + path;
    var started = Date.now();
    var TIMEOUT_MS = 180000;
    var timer = setInterval(function() {
      // cache-busting query gets a fresh answer past any cached 404
      fetch(url + '?warm=' + Date.now(), { method: 'GET', cache: 'no-store' })
        .then(function(res) {
          if (res.ok) {
            clearInterval(timer);
            status.style.background = '#e7f7ec';
            status.style.color = '#1c7c3c';
            status.textContent = '✓ Live and ready to share — link previews will work';
          } else if (Date.now() - started > TIMEOUT_MS) {
            clearInterval(timer);
            status.style.background = '#fdecec';
            status.style.color = '#a33636';
            status.textContent = 'Still publishing — give it a minute before sharing this link';
          }
        })
        .catch(function() {
          if (Date.now() - started > TIMEOUT_MS) clearInterval(timer);
        });
    }, 6000);
  }

  // Format phone number as (xxx) xxx-xxxx
  function formatPhoneNumber(phone) {
    if (!phone) return '';
    // Remove all non-digits
    var digits = String(phone).replace(/\D/g, '');
    // Check if we have 10 digits
    if (digits.length === 10) {
      return '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    }
    // If 11 digits starting with 1, skip the 1
    if (digits.length === 11 && digits[0] === '1') {
      return '(' + digits.substring(1, 4) + ') ' + digits.substring(4, 7) + '-' + digits.substring(7);
    }
    // Return original if can't format
    return phone;
  }

  // Populate flyer template with property data
  function populateDesign2(p, r, lo, photos, priceNum, fullAddress) {
    // Hero image
    var heroImg = document.getElementById('flyer2-hero-img');
    if (photos.length > 0) {
      heroImg.src = photos[0];
      heroImg.style.display = 'block';
    } else {
      heroImg.style.display = 'none';
    }

    // Price - dynamically adjust font size to fit on one line
    var priceEl = document.getElementById('flyer2-price');
    var formattedPrice = '$' + priceNum.toLocaleString();
    priceEl.textContent = formattedPrice;

    // Adjust font size based on price length to keep it on one line
    var priceLength = formattedPrice.length;
    var fontSize = 34; // default size
    if (priceLength > 10) {
      fontSize = 22; // $10,000,000+ (11+ chars)
    } else if (priceLength > 8) {
      fontSize = 26; // $1,000,000 - $9,999,999 (9-10 chars)
    }
    priceEl.style.fontSize = fontSize + 'px';

    // QR code linking to the property detail page
    var qrEl = document.getElementById('flyer2-qr');
    var propSlug = p.slug || (fullAddress + '-' + (p.city || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var propUrl = window.location.origin + '/properties-1/' + propSlug;
    qrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=' + encodeURIComponent(propUrl);

    // Thumbnail images
    var thumbIds = ['flyer2-thumb-1', 'flyer2-thumb-2', 'flyer2-thumb-3'];
    for (var i = 0; i < 3; i++) {
      var thumbEl = document.getElementById(thumbIds[i]);
      if (photos[i + 1]) {
        thumbEl.src = photos[i + 1];
        thumbEl.style.display = 'block';
      } else {
        thumbEl.style.display = 'none';
      }
    }

    // Address and location
    document.getElementById('flyer2-address').textContent = fullAddress;
    document.getElementById('flyer2-city-state').textContent = p.city + ', ' + p.state + ' ' + p.zip;

    // Stats
    document.getElementById('flyer2-bedrooms').textContent = p.bedrooms || '0';
    document.getElementById('flyer2-bathrooms').textContent = p.bathrooms || '0';
    var sqftNum = parseFloat(String(p.sqft || 0).replace(/,/g, '')) || 0;
    document.getElementById('flyer2-sqft').textContent = sqftNum.toLocaleString();
    document.getElementById('flyer2-year').textContent = p.yearBuilt || '';

    // Description
    document.getElementById('flyer2-description').textContent = p.description || '';

    // Realtor info
    document.getElementById('flyer2-realtor-name').textContent = r.name || 'Realtor';
    document.getElementById('flyer2-realtor-company').textContent = r.company || '';
    document.getElementById('flyer2-realtor-phone').textContent = formatPhoneNumber(r.phone);
    document.getElementById('flyer2-realtor-website').textContent = r.website || '';
    document.getElementById('flyer2-realtor-email').textContent = r.email || '';

    // Realtor license (under photo)
    var realtorLicenseEl = document.getElementById('flyer2-realtor-license');
    if (r.license) {
      realtorLicenseEl.textContent = 'License# ' + r.license;
    } else {
      realtorLicenseEl.textContent = '';
    }

    // Realtor photo
    var realtorPhotoEl = document.getElementById('flyer2-realtor-photo');
    if (r.photo) {
      realtorPhotoEl.src = r.photo;
      realtorPhotoEl.style.display = 'block';
    } else {
      realtorPhotoEl.style.display = 'none';
    }

    // Realtor company logo
    var realtorLogoContainer = document.getElementById('flyer2-realtor-logo-container');
    var realtorCompanyLogo = document.getElementById('flyer2-realtor-company-logo');
    if (r.logo) {
      realtorCompanyLogo.src = r.logo;
      realtorLogoContainer.style.display = 'flex';
    } else {
      realtorLogoContainer.style.display = 'none';
    }

    // Loan Officer info
    document.getElementById('flyer2-lo-name').textContent = lo.name || 'Loan Officer';
    document.getElementById('flyer2-lo-phone').textContent = formatPhoneNumber(lo.phone);
    document.getElementById('flyer2-lo-website').textContent = lo.website || '';
    document.getElementById('flyer2-lo-email').textContent = lo.email || '';

    // LO photo
    var loPhotoEl = document.getElementById('flyer2-lo-photo');
    if (lo.photo) {
      loPhotoEl.src = lo.photo;
      loPhotoEl.style.display = 'block';
    } else {
      loPhotoEl.style.display = 'none';
    }

    // NMLS
    var nmlsEl = document.getElementById('flyer2-nmls');
    if (lo.nmls) {
      nmlsEl.textContent = 'NMLS #' + lo.nmls;
    } else {
      nmlsEl.textContent = '';
    }
  }

  // Generate the actual PDF flyer using HTML template + html2canvas
  function generateFlyerPDF(data, images) {
    var p = data.property;
    var r = data.realtor;
    var lo = data.loanOfficer;
    var photos = data.photos || [];
    var address2Val = p.address_2 || '';
    var fullAddress = p.address + (address2Val ? ' ' + address2Val : '');
    var priceNum = parseFloat(String(p.price || 0).replace(/[$,]/g, '')) || 0;

    // Use Modern design template
    var template = document.getElementById('flyer-template-2');
    var content = document.getElementById('flyer-content-2');
    populateDesign2(p, r, lo, photos, priceNum, fullAddress);

    // Make template visible for rendering (move to visible area temporarily)
    template.style.left = '0';
    template.style.top = '0';
    template.style.zIndex = '9999';

    // Preload ALL images for full quality rendering
    var imagesToPreload = [];
    // Property photos
    photos.forEach(function(photo) {
      if (photo) imagesToPreload.push(photo);
    });
    // Headshots
    if (r.photo) imagesToPreload.push(r.photo);
    if (lo.photo) imagesToPreload.push(lo.photo);
    // Realtor company logo
    if (r.logo) imagesToPreload.push(r.logo);

    var preloadPromises = imagesToPreload.map(function(src) {
      return new Promise(function(resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          console.log('Preloaded:', src, img.naturalWidth, 'x', img.naturalHeight);
          resolve();
        };
        img.onerror = resolve;
        img.src = src;
      });
    });

    // Wait for all images to preload then render
    Promise.all(preloadPromises).then(function() {
      setTimeout(function() {
        html2canvas(content, {
          scale: 5,  // Maximum scale for full resolution
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 612,
          height: 792,
          logging: false,
          imageTimeout: 0,  // No timeout for image loading
          onclone: function(clonedDoc) {
            // Ensure all images render at highest quality
            var imgs = clonedDoc.querySelectorAll('img');
            imgs.forEach(function(img) {
              img.style.imageRendering = 'auto';
              img.setAttribute('crossorigin', 'anonymous');
            });
            // Handle background images
            var bgDivs = clonedDoc.querySelectorAll('[style*="background-image"]');
            bgDivs.forEach(function(div) {
              div.style.imageRendering = 'auto';
            });
          }
        }).then(function(canvas) {
        // Hide template again
        template.style.left = '-9999px';
        template.style.zIndex = 'auto';

        // Create PDF
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF('p', 'pt', 'letter');

        // Add canvas as JPEG to PDF (smaller file size, good quality)
        var imgData = canvas.toDataURL('image/jpeg', 0.9);
        doc.addImage(imgData, 'JPEG', 0, 0, 612, 792);

        // Save
        var filename = fullAddress.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-flyer.pdf';
        doc.save(filename);
        }).catch(function(err) {
          console.error('html2canvas error:', err);
          // Hide template on error too
          template.style.left = '-9999px';
          template.style.zIndex = 'auto';
          showToast('Error generating flyer: ' + err.message, 'error');
        });
      }, 800); // Give images time to fully load
    }); // End Promise.all.then
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
            // Use path first (HubDB dynamic page path), then slug, then generate from name
            var pathVal = prop.path || vals.path || vals.slug || '';
            if (!pathVal && vals.name) {
              // Generate slug from name as fallback
              pathVal = vals.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }
            var propUrl = '/properties-1/' + pathVal;
            var propName = vals.name || vals.address || 'Property';
            var propPrice = vals.price || 0;
            html += '<div class="site-item" data-id="' + prop.id + '">';
            html += '<div class="site-info">';
            html += '<a href="' + propUrl + '" target="_blank" class="site-name">' + propName + '</a>';
            html += '<span class="site-price">$' + propPrice.toLocaleString() + '</span>';
            html += '</div>';
            html += '<div class="actions">';
            html += '<button type="button" class="edit-site" data-id="' + prop.id + '" title="Edit">&#9998;</button>';
            html += '<button type="button" class="copy-site-url" data-url="' + propUrl + '" title="Copy URL">&#128203;</button>';
            html += '<button type="button" class="delete-site" data-id="' + prop.id + '" title="Delete">&#128465;</button>';
            html += '</div></div>';
          }
          list.innerHTML = html;

          // Add handlers
          list.querySelectorAll('.edit-site').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var rowId = this.getAttribute('data-id');
              loadPropertyForEdit(rowId);
            });
          });
          list.querySelectorAll('.copy-site-url').forEach(function(btn) {
            btn.addEventListener('click', function() {
              navigator.clipboard.writeText(this.getAttribute('data-url'));
              showToast('URL copied!', 'success');
            });
          });
          list.querySelectorAll('.delete-site').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var rowId = this.getAttribute('data-id');
              var propName = this.closest('.site-item').querySelector('.site-name').textContent;
              // Show confirmation modal instead of direct delete
              showDeleteConfirmation(rowId, propName);
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

  function showDeleteConfirmation(rowId, propName) {
    pendingDeleteId = rowId;
    var modal = document.getElementById('delete-modal');
    var nameSpan = document.getElementById('delete-prop-name');
    if (modal && nameSpan) {
      nameSpan.textContent = propName || 'this property';
      modal.classList.add('active');
    } else {
      // Fallback if modal not available - still require double action
      if (window._deleteConfirmPending === rowId) {
        deleteProperty(rowId);
        window._deleteConfirmPending = null;
      } else {
        window._deleteConfirmPending = rowId;
        showToast('Click delete again to confirm', 'info');
        setTimeout(function() { window._deleteConfirmPending = null; }, 3000);
      }
    }
  }

  function closeDeleteModal() {
    var modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('active');
    pendingDeleteId = null;
  }

  function confirmDelete() {
    console.log('confirmDelete called, pendingDeleteId:', pendingDeleteId);
    if (pendingDeleteId) {
      deleteProperty(pendingDeleteId);
      closeDeleteModal();
    } else {
      console.log('No pendingDeleteId set!');
    }
  }

  function deleteProperty(rowId) {
    console.log('deleteProperty called with rowId:', rowId);
    console.log('API URL:', API_BASE + '/deleteprop');
    fetch(API_BASE + '/deleteprop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: rowId,
        userEmail: currentUserEmail
      })
    })
    .then(function(res) {
      console.log('deleteprop response status:', res.status);
      return res.json();
    })
    .then(function(data) {
      console.log('deleteprop response:', data);
      if (data.success) {
        showToast('Property deleted', 'success');
        loadExistingProperties();
      } else {
        showToast('Error: ' + (data.error || 'Could not delete'), 'error');
      }
    })
    .catch(function(err) {
      console.error('deleteprop error:', err);
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
    // If in edit mode, this acts as cancel
    if (editMode) {
      editMode = false;
      currentEditRowId = null;
      currentEditSlug = null;
      updateEditModeUI();
    }

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

  // ===== EDIT MODE FUNCTIONS =====

  function loadPropertyForEdit(rowId) {
    showToast('Loading property...', 'info');

    fetch(API_BASE + '/getprop?id=' + rowId + '&email=' + encodeURIComponent(currentUserEmail))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.property) {
          populateFormFromProperty(data.property);
          editMode = true;
          currentEditRowId = rowId;
          currentEditSlug = data.property.values.slug || data.property.path;
          updateEditModeUI();
          showToast('Property loaded for editing', 'success');

          // Scroll to top of form
          var form = document.getElementById('property-form');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          showToast('Error: ' + (data.error || 'Could not load property'), 'error');
        }
      })
      .catch(function(err) {
        console.error('Error loading property:', err);
        showToast('Error loading property', 'error');
      });
  }

  function populateFormFromProperty(prop) {
    var vals = prop.values || prop;
    var form = document.getElementById('property-form');

    function setValue(name, value) {
      var el = form.querySelector('[name="' + name + '"]');
      if (el && value !== undefined && value !== null) {
        el.value = value;
      }
    }

    // Property info
    setValue('address', vals.address);
    setValue('address2', vals.address_2);
    setValue('city', vals.city);
    setValue('state', vals.state);
    setValue('zip', vals.zip);
    setValue('price', vals.price ? '$' + parseInt(vals.price).toLocaleString() : '');
    setValue('bedrooms', vals.bedrooms);
    setValue('bathrooms', vals.bathrooms);
    setValue('sqft', vals.sqft ? parseInt(vals.sqft).toLocaleString() : '');
    setValue('yearBuilt', vals.year_built);
    setValue('mlsNumber', vals.mls_number);
    setValue('openHouseDate', vals.open_house_date);
    setValue('openHouseStart', vals.open_house_start);
    setValue('openHouseEnd', vals.open_house_end);
    setValue('description', vals.description);
    setValue('features', vals.features);

    // Realtor info
    setValue('realtorName', vals.realtor_name);
    setValue('realtorTitle', vals.realtor_title);
    setValue('realtorCompany', vals.realtor_company);
    setValue('realtorPhone', vals.realtor_phone);
    setValue('realtorEmail', vals.realtor_email);
    setValue('realtorLicense', vals.realtor_license);
    setValue('realtorWebsite', vals.realtor_website);

    // Load realtor logo
    if (vals.realtor_logo) {
      realtorLogo = vals.realtor_logo;
      var logoPreview = document.getElementById('realtor-logo-preview');
      if (logoPreview) {
        logoPreview.innerHTML = '<img src="' + vals.realtor_logo + '" alt="Logo">';
      }
    }

    // Load realtor photo
    if (vals.realtor_photo) {
      realtorPhoto = vals.realtor_photo;
      var realtorAvatar = document.getElementById('realtor-avatar');
      if (realtorAvatar) {
        realtorAvatar.innerHTML = '<img src="' + vals.realtor_photo + '" alt="Photo"><input type="file" accept="image/*" id="realtor-photo-input" hidden>';
        realtorAvatar.removeAttribute('data-listener-attached');
        setupContactPhotoUploads();
      }
    }

    // LO info
    setValue('loName', vals.lo_name);
    setValue('loTitle', vals.lo_title);
    setValue('loCompany', vals.lo_company);
    setValue('loPhone', vals.lo_phone);
    setValue('loEmail', vals.lo_email);
    setValue('loNmls', vals.lo_nmls);
    setValue('loWebsite', vals.lo_website);

    // Load LO photo
    if (vals.lo_photo) {
      loanOfficerPhoto = vals.lo_photo;
      var loAvatar = document.getElementById('lo-avatar');
      if (loAvatar) {
        loAvatar.innerHTML = '<img src="' + vals.lo_photo + '" alt="Photo"><input type="file" accept="image/*" id="lo-photo-input" hidden>';
        loAvatar.removeAttribute('data-listener-attached');
        setupContactPhotoUploads();
      }
    }

    // Neighborhood
    var showNeighborhood = document.getElementById('show-neighborhood');
    var neighborhoodFields = document.getElementById('neighborhood-fields');
    if (showNeighborhood && neighborhoodFields) {
      showNeighborhood.checked = vals.show_neighborhood || false;
      if (vals.show_neighborhood) {
        neighborhoodFields.classList.remove('hidden');
      } else {
        neighborhoodFields.classList.add('hidden');
      }
    }
    setValue('walkScore', vals.walk_score);
    setValue('transitScore', vals.transit_score);
    setValue('bikeScore', vals.bike_score);
    setValue('amenities', vals.amenities);

    // Photos - parse JSON string
    uploadedPhotos = [];
    if (vals.photos) {
      try {
        var photosArray = typeof vals.photos === 'string' ? JSON.parse(vals.photos) : vals.photos;
        if (Array.isArray(photosArray)) {
          uploadedPhotos = photosArray;
        }
      } catch (e) {
        console.error('Error parsing photos:', e);
      }
    }
    renderPhotoPreview();
  }

  function updateEditModeUI() {
    var btn = document.getElementById('generate-btn');
    var editBanner = document.getElementById('edit-mode-banner');
    var clearBtn = document.getElementById('clear-btn');

    if (editMode) {
      if (btn) {
        btn.textContent = 'Update Property Site';
        btn.classList.add('edit-mode');
      }
      if (editBanner) {
        editBanner.style.display = 'flex';
      }
      if (clearBtn) {
        clearBtn.textContent = 'Cancel Edit';
      }
    } else {
      if (btn) {
        btn.textContent = 'Create Property Site';
        btn.classList.remove('edit-mode');
      }
      if (editBanner) {
        editBanner.style.display = 'none';
      }
      if (clearBtn) {
        clearBtn.textContent = 'Clear Form';
      }
    }
  }

  function cancelEdit(silent) {
    editMode = false;
    currentEditRowId = null;
    currentEditSlug = null;
    updateEditModeUI();

    if (!silent) {
      clearForm();
      showToast('Edit cancelled', 'info');
    }
  }
})();
