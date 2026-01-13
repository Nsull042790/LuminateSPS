// Property Generator Module JavaScript v5.8 - HubDB Version
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
    console.log('Property Generator v5.10 (HubDB) initialized');

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
        address2: getValue('address2') || '',
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

    // Add up to 3 property photos
    for (var i = 0; i < Math.min(3, photos.length); i++) {
      imagesToLoad.push({ key: 'photo' + i, url: photos[i] });
    }

    // Add Luminate Bank logo (white version for dark blue LO card)
    imagesToLoad.push({
      key: 'luminateLogo',
      url: 'https://244637957.fs1.hubspotusercontent-na2.net/hubfs/244637957/Luminatebank_PrimaryLogo_White_Gradient.png',
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
  var LUMINATE_LOGO_BASE64 = 'data:image/png;base64,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ICCZIIJEJSqUoIJVVJJWCSJBZSSJKUJSIJKRRJQpJEJKESJUkkUiUpUiVJEhKJSiFBFJJSJJJSJEWRSSRJJKlSJJGkJKFIEJKkSJISSFIklJJGJJBSJKlEElIqCiSSUiRJCJLSREsqlCREUpKkJJSShCRRJJJAhCpElCSqEkJJIpKUFSQpJKkiSYqISIpIUKlESUpJokikEklJJCmUJCEiKYVJJJaUJFUSkSCJJJKkShIkJJSSEkVJEJKUJJaQSBJJJKGUSCYJUliSEJKkUFKJyEJpEkISlkgiiUIkIUkSKZKkCJJJJJJIkqSSJIlIlJZSJCRJKJEUpQmJVCUJJElSKJKSJCKZJJJYSqFJJIlJJCkSWkuJSSJJEhISktRSEkkJJJIkJAQRSSipQkipVEkkIZFSkiQkqVRJJZaQJJGEJBJSWUJJJJZUlJAiIkkSJEIqqUokIZFJJIlJIpMlJJLCZEmqRIJJJJZSEkkkJEliJBJJKJGlEkkklJISJJGkJEkoIRFJJJGkKEqKRJJYSCRJJCFJIkmFJJEkJJGJJJKkJIEkJJEkJJlKkYRJJIkkqSQpRBIKJRRJJJEqIZJJJJJEkkRJkUqSIpJIJJEkSYhIQpJIJJQklJAiIpKkSCShCEqJJJEllJJIkpJIJJEkYSklIkiSSKJQSiYSSYolSSghJQlJQkIJJSEJJJYSkiREIpJIkkhSSSSJhCRJCCUhJKOEJCRJCCUhJSEtSYpIQokkJCFJQiERSSQllYSQhCRVJEVKJYpIIokiJZKQRCSRJJKQpBCRJJJJJpJJQpJKIomkTESSUClJIkkoJSWkJEmSCCSJJCShJCFJJYqQhJJIJJKESKQVJJIkkiREJCGJJBJJJJpIklBCKKEkSZAqkihCkiQSJSGSkoQkkZCkIpJIJJIqJSIJJJQkSRKVJJKSCIkkJSKJJJIkJJJIJEmIVCqJqJREIokklJRIJFIkJJEkSUOIJJJVJKEkJJIQSkhKEkIJJJVIIokkkpCEkkgiiUQSCUkSSUhSSSqRJJJIJJElJCEkJJJEQkJJRVJJIiJJCCWRSEiJJJJEJJFJIkkoJYkkJJJQJJGkJJISRYJEEkkiSUISSSxJJKEkkZBIJJEkhSSRpJJIJEkSSSQhiYRJJCRJJJJEJJFIkpJIUpIkkiQkkiQUUiSSRJJIJJJEJJJEJJGkEkkkkiSSVJKSRJISSiKJhCQJJZGQJJFESKQRISUSSRJJSCSRJCSRJJJJJCGJhJJIJJIkJJJEEolUkkgiIZJISqJIQhIJSSQkJJFSIiGJSCKJhIQkJSGRhCSRJCSRRJJIJJKkJJJIQiKSSCIhIZIliSQRJZJIYomERIqkJJFUIkkkkUgiCUkkkkQSSEgiJZJEJJKEJJJIIkkqkUQkJJJIJEmISJJKJJJIJJIkkiQSSSSRJJJIEpJIJJJIIpFJJBJJJJFEJJFIEpGkhJBEJJEkJJKQSEIiiSQSSSQhkiQSSSSSSUJJJJFIJJJEkpBIIokkkqokiSQkkpBIElJCIomEJJJJJCSSJJJJJJIkkZBQJJFIJCGhJJFIJJGkJJJIJBJJJJKQJJJIJJJIJJKkJJJIJBJJJJJIJJEkJJJIJJGkJJJIJJJIJJJIJJJIJJJIJJJIJJJIJJJI';

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

  // Generate the actual PDF flyer
  function generateFlyerPDF(data, images) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF('p', 'pt', 'letter'); // 612 x 792 points

    var pageWidth = 612;
    var pageHeight = 792;
    var margin = 30;
    var contentWidth = pageWidth - (margin * 2);

    // Colors
    var primaryColor = [13, 23, 60];      // #0d173c
    var accentColor = [150, 218, 248];    // #96daf8
    var grayColor = [100, 116, 139];      // #64748b
    var greenColor = [17, 153, 142];      // #11998e
    var lightBg = [248, 250, 252];        // #f8fafc

    var p = data.property;
    var r = data.realtor;
    var lo = data.loanOfficer;
    var fullAddress = p.address + (p.address2 ? ' ' + p.address2 : '');

    // ===== HEADER BAR WITH PRICE =====
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 50, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FOR SALE', margin, 33);

    var priceNum = parseFloat(String(p.price || 0).replace(/[$,]/g, '')) || 0;
    doc.setFontSize(20);
    doc.text('$' + priceNum.toLocaleString(), pageWidth - margin, 33, { align: 'right' });

    var yPos = 60;

    // ===== HERO PHOTO (large) - with proper aspect ratio =====
    var heroBoxHeight = 220;
    if (images.photo0) {
      try {
        var heroDims = fitImageToBox(images.photo0, contentWidth, heroBoxHeight);
        var heroX = margin + (contentWidth - heroDims.width) / 2; // Center horizontally
        doc.addImage(images.photo0.data, 'JPEG', heroX, yPos, heroDims.width, heroDims.height, undefined, 'MEDIUM');
        yPos += heroDims.height + 10;
      } catch (e) {
        console.log('Hero image error:', e);
        yPos += 10;
      }
    }

    // ===== TWO SMALLER PHOTOS - with proper aspect ratio =====
    var smallPhotoWidth = (contentWidth - 10) / 2;
    var smallPhotoHeight = 110;
    var hasSmallPhotos = images.photo1 || images.photo2;

    if (hasSmallPhotos) {
      if (images.photo1) {
        try {
          var dims1 = fitImageToBox(images.photo1, smallPhotoWidth, smallPhotoHeight);
          var x1 = margin + (smallPhotoWidth - dims1.width) / 2;
          var y1 = yPos + (smallPhotoHeight - dims1.height) / 2;
          doc.addImage(images.photo1.data, 'JPEG', x1, y1, dims1.width, dims1.height, undefined, 'MEDIUM');
        } catch (e) { console.log('Photo 2 error:', e); }
      }
      if (images.photo2) {
        try {
          var dims2 = fitImageToBox(images.photo2, smallPhotoWidth, smallPhotoHeight);
          var x2 = margin + smallPhotoWidth + 10 + (smallPhotoWidth - dims2.width) / 2;
          var y2 = yPos + (smallPhotoHeight - dims2.height) / 2;
          doc.addImage(images.photo2.data, 'JPEG', x2, y2, dims2.width, dims2.height, undefined, 'MEDIUM');
        } catch (e) { console.log('Photo 3 error:', e); }
      }
      yPos += smallPhotoHeight + 15;
    }

    // ===== PROPERTY ADDRESS & LOCATION =====
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(fullAddress, margin, yPos);
    yPos += 18;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(p.city + ', ' + p.state + ' ' + p.zip, margin, yPos);
    yPos += 20;

    // ===== STATS ROW =====
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(margin, yPos, contentWidth, 45, 5, 5, 'F');

    var statsY = yPos + 28;
    var statCols = 4;
    var statWidth = contentWidth / statCols;

    var stats = [];
    if (p.bedrooms) stats.push({ value: String(p.bedrooms), label: 'Beds' });
    if (p.bathrooms) stats.push({ value: String(p.bathrooms), label: 'Baths' });
    if (p.sqft) {
      var sqftNum = parseFloat(String(p.sqft).replace(/,/g, '')) || 0;
      stats.push({ value: sqftNum.toLocaleString(), label: 'Sq Ft' });
    }
    if (p.yearBuilt && p.yearBuilt !== '0' && p.yearBuilt !== 0) {
      stats.push({ value: String(p.yearBuilt), label: 'Year Built' });
    }

    var actualStatWidth = contentWidth / Math.max(stats.length, 1);
    stats.forEach(function(stat, idx) {
      var statX = margin + (actualStatWidth * idx) + (actualStatWidth / 2);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(stat.value, statX, statsY - 5, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text(stat.label, statX, statsY + 8, { align: 'center' });
    });

    yPos += 55;

    // ===== DESCRIPTION =====
    if (p.description) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('About This Property', margin, yPos);
      yPos += 14;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      var descText = p.description.substring(0, 500);
      var descLines = doc.splitTextToSize(descText, contentWidth);
      var maxDescLines = 5;
      doc.text(descLines.slice(0, maxDescLines), margin, yPos);
      yPos += (Math.min(descLines.length, maxDescLines) * 11) + 10;
    }

    // ===== MLS NUMBER =====
    if (p.mlsNumber) {
      doc.setFontSize(8);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('MLS# ' + p.mlsNumber, margin, yPos);
      yPos += 15;
    }

    // ===== CONTACT SECTION =====
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Contact Us', margin, yPos);
    yPos += 15;

    // Two-column contact cards
    var cardWidth = (contentWidth - 15) / 2;
    var cardHeight = 95;
    var cardStartY = yPos;
    var photoBoxSize = 55; // Box size for photos

    // ===== REALTOR CARD (white background) =====
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, cardStartY, cardWidth, cardHeight, 4, 4, 'FD');

    var realtorInfoX = margin + 12;
    var realtorInfoY = cardStartY + 15;

    // Realtor photo - with proper aspect ratio
    if (images.realtorPhoto) {
      try {
        var rPhotoDims = fitImageToBox(images.realtorPhoto, photoBoxSize, photoBoxSize);
        var rPhotoX = margin + cardWidth - photoBoxSize - 8 + (photoBoxSize - rPhotoDims.width) / 2;
        var rPhotoY = cardStartY + 8 + (photoBoxSize - rPhotoDims.height) / 2;
        doc.addImage(images.realtorPhoto.data, 'JPEG', rPhotoX, rPhotoY, rPhotoDims.width, rPhotoDims.height, undefined, 'MEDIUM');
      } catch (e) { console.log('Realtor photo error:', e); }
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(r.name || 'Realtor', realtorInfoX, realtorInfoY);
    realtorInfoY += 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(r.title || 'Licensed Realtor', realtorInfoX, realtorInfoY);
    realtorInfoY += 10;
    if (r.company) { doc.text(r.company, realtorInfoX, realtorInfoY); realtorInfoY += 10; }
    if (r.phone) { doc.text(r.phone, realtorInfoX, realtorInfoY); realtorInfoY += 10; }
    if (r.email) { doc.text(r.email, realtorInfoX, realtorInfoY); realtorInfoY += 10; }

    // Realtor company logo at bottom of card
    // Realtor company logo at bottom of card (PNG with transparency)
    if (images.realtorLogo) {
      try {
        var rLogoDims = fitImageToBox(images.realtorLogo, 70, 18);
        var rLogoFormat = images.realtorLogo.isPng ? 'PNG' : 'JPEG';
        doc.addImage(images.realtorLogo.data, rLogoFormat, margin + cardWidth - rLogoDims.width - 8, cardStartY + cardHeight - rLogoDims.height - 5, rLogoDims.width, rLogoDims.height, undefined, 'MEDIUM');
      } catch (e) { console.log('Realtor logo error:', e); }
    }

    // ===== LOAN OFFICER CARD (blue background, white text) =====
    var loCardX = margin + cardWidth + 15;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(loCardX, cardStartY, cardWidth, cardHeight, 4, 4, 'FD');

    var loInfoX = loCardX + 12;
    var loInfoY = cardStartY + 15;

    // LO photo - with proper aspect ratio
    if (images.loPhoto) {
      try {
        var loPhotoDims = fitImageToBox(images.loPhoto, photoBoxSize, photoBoxSize);
        var loPhotoX = loCardX + cardWidth - photoBoxSize - 8 + (photoBoxSize - loPhotoDims.width) / 2;
        var loPhotoY = cardStartY + 8 + (photoBoxSize - loPhotoDims.height) / 2;
        doc.addImage(images.loPhoto.data, 'JPEG', loPhotoX, loPhotoY, loPhotoDims.width, loPhotoDims.height, undefined, 'MEDIUM');
      } catch (e) { console.log('LO photo error:', e); }
    }

    // LO Name - accent color
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(lo.name || 'Loan Officer', loInfoX, loInfoY);
    loInfoY += 12;

    // LO details - white text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(lo.title || 'Loan Officer', loInfoX, loInfoY);
    loInfoY += 10;
    if (lo.company) { doc.text(lo.company, loInfoX, loInfoY); loInfoY += 10; }
    if (lo.phone) { doc.text(lo.phone, loInfoX, loInfoY); loInfoY += 10; }
    if (lo.email) { doc.text(lo.email, loInfoX, loInfoY); loInfoY += 10; }
    if (lo.nmls) { doc.text('NMLS# ' + lo.nmls, loInfoX, loInfoY); }

    // Luminate Bank logo at bottom of LO card (PNG with transparency)
    if (images.luminateLogo) {
      try {
        var loLogoDims = fitImageToBox(images.luminateLogo, 95, 24);
        var loLogoX = loCardX + cardWidth - loLogoDims.width - 8;
        var loLogoY = cardStartY + cardHeight - loLogoDims.height - 6;
        var logoFormat = images.luminateLogo.isPng ? 'PNG' : 'JPEG';
        doc.addImage(images.luminateLogo.data, logoFormat, loLogoX, loLogoY, loLogoDims.width, loLogoDims.height, undefined, 'MEDIUM');
      } catch (e) {
        console.log('LO logo error:', e);
        // Fallback to text
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text('LUMINATE BANK', loCardX + cardWidth - 12, cardStartY + cardHeight - 10, { align: 'right' });
      }
    } else {
      // Fallback to text if logo didn't load
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('LUMINATE BANK', loCardX + cardWidth - 12, cardStartY + cardHeight - 10, { align: 'right' });
    }

    // ===== FOOTER =====
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, pageHeight - 50, pageWidth, 50, 'F');

    // Full compliance disclaimer (no logo in footer)
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    var disclaimer = 'Luminate Bank NMLS 1281698 | Bank Headquarters: 2523 S. Wayzata Blvd., Suite 100, Minneapolis, MN 55405 | (952) 939-7200 | This is not an offer to enter into an agreement. Information, rates and programs are subject to change without prior notice and may not be available in all states. All loans are subject to credit and property approval. Luminate Bank is not affiliated with any government agency. 2026 Luminate Bank. All rights reserved. Member FDIC. Equal Housing Opportunity Lender.';
    var disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
    doc.text(disclaimerLines, margin, pageHeight - 38);

    // Save the PDF
    var filename = fullAddress.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-flyer.pdf';
    doc.save(filename);
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
    if (pendingDeleteId) {
      deleteProperty(pendingDeleteId);
      closeDeleteModal();
    }
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
    setValue('address2', vals.address2);
    setValue('city', vals.city);
    setValue('state', vals.state);
    setValue('zip', vals.zip);
    setValue('price', vals.price ? '$' + parseInt(vals.price).toLocaleString() : '');
    setValue('bedrooms', vals.bedrooms);
    setValue('bathrooms', vals.bathrooms);
    setValue('sqft', vals.sqft ? parseInt(vals.sqft).toLocaleString() : '');
    setValue('yearBuilt', vals.year_built);
    setValue('mlsNumber', vals.mls_number);
    setValue('description', vals.description);
    setValue('features', vals.features);

    // Realtor info
    setValue('realtorName', vals.realtor_name);
    setValue('realtorTitle', vals.realtor_title);
    setValue('realtorCompany', vals.realtor_company);
    setValue('realtorPhone', vals.realtor_phone);
    setValue('realtorEmail', vals.realtor_email);
    setValue('realtorLicense', vals.realtor_license);

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
