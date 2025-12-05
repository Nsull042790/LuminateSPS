// State
let uploadedPhotos = [];
let realtorPhoto = null;
let loanOfficerPhoto = null;
let githubConfigured = false;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkGitHubStatus();
    loadProperties();
    setupPhotoUpload();
    setupContactPhotoUploads();
    setupFormHandlers();
    setupModalHandlers();
});

// Set up modal button event listeners
function setupModalHandlers() {
    // Preview modal handlers
    document.getElementById('preview-close-btn').addEventListener('click', closePreview);
    document.getElementById('preview-close-btn-footer').addEventListener('click', closePreview);
    document.getElementById('preview-publish-btn').addEventListener('click', generateFromPreview);

    // Success modal handlers
    document.getElementById('success-close-btn').addEventListener('click', closeSuccessModal);
    document.getElementById('success-copy-btn').addEventListener('click', copySuccessUrl);
}

// Check GitHub configuration
async function checkGitHubStatus() {
    try {
        var res = await fetch('/api/config');
        var data = await res.json();
        githubConfigured = data.githubConfigured;

        var statusDot = document.getElementById('github-status');
        var statusText = document.getElementById('github-status-text');

        if (githubConfigured) {
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'GitHub Connected: ' + data.owner + '/' + data.repo;
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = 'GitHub not configured';
        }
    } catch (err) {
        console.error('Error checking GitHub status:', err);
    }
}

// Load existing properties
async function loadProperties() {
    try {
        var res = await fetch('/api/properties');
        var data = await res.json();
        var list = document.getElementById('properties-list');

        if (data.properties && data.properties.length > 0) {
            var html = '';
            for (var i = 0; i < data.properties.length; i++) {
                var p = data.properties[i];
                html += '<div class="property-item">';
                html += '<a href="' + p.url + '" target="_blank" class="property-link">' + p.slug + '</a>';
                html += '<div class="property-actions">';
                html += '<button class="copy-btn" data-url="' + p.url + '" title="Copy URL">📋</button>';
                html += '<button class="delete-btn" data-slug="' + p.slug + '" title="Delete" style="color: var(--error);">🗑️</button>';
                html += '</div>';
                html += '</div>';
            }
            list.innerHTML = html;

            // Add event listeners for copy buttons
            var copyBtns = list.querySelectorAll('.copy-btn');
            for (var j = 0; j < copyBtns.length; j++) {
                copyBtns[j].addEventListener('click', function() {
                    copyUrl(this.getAttribute('data-url'));
                });
            }

            // Add event listeners for delete buttons
            var deleteBtns = list.querySelectorAll('.delete-btn');
            for (var k = 0; k < deleteBtns.length; k++) {
                deleteBtns[k].addEventListener('click', function() {
                    deleteProperty(this.getAttribute('data-slug'));
                });
            }
        } else {
            list.innerHTML = '<p style="color: var(--gray-600); font-size: 0.9em;">No properties yet. Create your first one!</p>';
        }
    } catch (err) {
        console.error('Error loading properties:', err);
    }
}

// Photo upload handling
function setupPhotoUpload() {
    var uploadArea = document.getElementById('photo-upload-area');
    var photoInput = document.getElementById('photo-input');

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

async function handlePhotoFiles(files) {
    var formData = new FormData();
    for (var i = 0; i < files.length; i++) {
        if (uploadedPhotos.length >= 20) {
            showToast('Maximum 20 photos allowed', 'error');
            break;
        }
        formData.append('photos', files[i]);
    }

    try {
        var res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        var data = await res.json();

        if (data.success) {
            for (var j = 0; j < data.files.length; j++) {
                var file = data.files[j];
                uploadedPhotos.push({
                    path: file.path,
                    label: '',
                    preview: file.path
                });
            }
            renderPhotoPreview();
            showToast(data.files.length + ' photo(s) uploaded', 'success');
        }
    } catch (err) {
        showToast('Error uploading photos', 'error');
    }
}

function renderPhotoPreview() {
    var grid = document.getElementById('photo-preview-grid');
    var html = '';
    for (var i = 0; i < uploadedPhotos.length; i++) {
        var photo = uploadedPhotos[i];
        html += '<div class="photo-preview-item">';
        html += '<img src="' + photo.preview + '" alt="Photo ' + (i + 1) + '">';
        html += '<button class="remove-btn" data-index="' + i + '">&times;</button>';
        html += '<div class="photo-label">';
        html += '<input type="text" placeholder="Add label..." value="' + photo.label + '" data-index="' + i + '">';
        html += '</div>';
        html += '</div>';
    }
    grid.innerHTML = html;

    // Add event listeners for remove buttons
    var removeBtns = grid.querySelectorAll('.remove-btn');
    for (var j = 0; j < removeBtns.length; j++) {
        removeBtns[j].addEventListener('click', function() {
            removePhoto(parseInt(this.getAttribute('data-index')));
        });
    }

    // Add event listeners for label inputs
    var labelInputs = grid.querySelectorAll('.photo-label input');
    for (var k = 0; k < labelInputs.length; k++) {
        labelInputs[k].addEventListener('change', function() {
            updatePhotoLabel(parseInt(this.getAttribute('data-index')), this.value);
        });
    }
}

function removePhoto(index) {
    uploadedPhotos.splice(index, 1);
    renderPhotoPreview();
}

function updatePhotoLabel(index, label) {
    uploadedPhotos[index].label = label;
}

// Contact photo uploads
function setupContactPhotoUploads() {
    var realtorInput = document.getElementById('realtor-photo-input');
    if (realtorInput) {
        realtorInput.addEventListener('change', async function(e) {
            var file = e.target.files[0];
            if (file) {
                var formData = new FormData();
                formData.append('photos', file);
                var res = await fetch('/api/upload', { method: 'POST', body: formData });
                var data = await res.json();
                if (data.success) {
                    realtorPhoto = data.files[0].path;
                    document.getElementById('realtor-avatar').innerHTML =
                        '<img src="' + realtorPhoto + '" alt="Realtor"><input type="file" accept="image/*" id="realtor-photo-input">';
                    setupContactPhotoUploads();
                }
            }
        });
    }

    var loInput = document.getElementById('lo-photo-input');
    if (loInput) {
        loInput.addEventListener('change', async function(e) {
            var file = e.target.files[0];
            if (file) {
                var formData = new FormData();
                formData.append('photos', file);
                var res = await fetch('/api/upload', { method: 'POST', body: formData });
                var data = await res.json();
                if (data.success) {
                    loanOfficerPhoto = data.files[0].path;
                    document.getElementById('lo-avatar').innerHTML =
                        '<img src="' + loanOfficerPhoto + '" alt="Loan Officer"><input type="file" accept="image/*" id="lo-photo-input">';
                    setupContactPhotoUploads();
                }
            }
        });
    }
}

// Form handlers
function setupFormHandlers() {
    document.getElementById('generate-btn').addEventListener('click', generateSite);
    document.getElementById('preview-btn').addEventListener('click', previewSite);
    document.getElementById('clear-btn').addEventListener('click', clearForm);

    // Format price input
    var priceInput = document.querySelector('input[name="property.price"]');
    priceInput.addEventListener('blur', function() {
        var value = parseFloat(this.value.replace(/[$,]/g, '')) || 0;
        if (value > 0) {
            this.value = '$' + value.toLocaleString();
        }
    });

    // Format sqft input
    var sqftInput = document.querySelector('input[name="property.sqft"]');
    sqftInput.addEventListener('blur', function() {
        var value = parseFloat(this.value.replace(/,/g, '')) || 0;
        if (value > 0) {
            this.value = value.toLocaleString();
        }
    });

    // Neighborhood toggle
    var neighborhoodToggle = document.getElementById('show-neighborhood');
    var neighborhoodFields = document.getElementById('neighborhood-fields');
    neighborhoodToggle.addEventListener('change', function() {
        if (this.checked) {
            neighborhoodFields.classList.remove('hidden');
        } else {
            neighborhoodFields.classList.add('hidden');
        }
    });
}

function getFormData() {
    var form = document.getElementById('property-form');
    var formData = new FormData(form);
    var data = { property: {}, realtor: {}, loanOfficer: {}, photos: [], testimonials: [] };

    var entries = formData.entries();
    var entry = entries.next();
    while (!entry.done) {
        var key = entry.value[0];
        var value = entry.value[1];
        var parts = key.split('.');
        if (parts.length === 2) {
            data[parts[0]][parts[1]] = value;
        }
        entry = entries.next();
    }

    // Parse numeric values
    data.property.price = parseFloat((data.property.price || '').replace(/[$,]/g, '')) || 0;
    data.property.sqft = parseFloat((data.property.sqft || '').replace(/,/g, '')) || 0;
    data.property.bedrooms = parseInt(data.property.bedrooms) || 0;
    data.property.yearBuilt = parseInt(data.property.yearBuilt) || 0;

    // Add photos
    data.photos = [];
    for (var i = 0; i < uploadedPhotos.length; i++) {
        data.photos.push({ path: uploadedPhotos[i].path, label: uploadedPhotos[i].label });
    }

    // Add contact photos
    if (realtorPhoto) data.realtor.photo = realtorPhoto;
    if (loanOfficerPhoto) data.loanOfficer.photo = loanOfficerPhoto;

    // Add section toggles
    data.showNeighborhood = document.getElementById('show-neighborhood').checked;

    return data;
}

async function generateSite() {
    var btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Generating...';

    try {
        var data = getFormData();
        var res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        var result = await res.json();

        if (result.success) {
            if (result.published) {
                document.getElementById('success-url').textContent = result.url;
                document.getElementById('success-url').href = result.url;
                document.getElementById('success-link').href = result.url;
                document.getElementById('success-modal').classList.add('active');
                loadProperties();
            } else {
                // Download HTML if not published
                var blob = new Blob([result.html], { type: 'text/html' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = result.propertySlug + '.html';
                a.click();
                showToast('HTML downloaded. Configure GitHub for auto-publishing.', 'info');
            }
        } else {
            showToast(result.error || 'Error generating site', 'error');
        }
    } catch (err) {
        showToast('Error generating site', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<span>Generate & Publish</span>';
}

async function previewSite() {
    try {
        var data = getFormData();
        var res = await fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        var result = await res.json();

        if (result.success) {
            var iframe = document.getElementById('preview-iframe');
            iframe.srcdoc = result.html;
            document.getElementById('preview-modal').classList.add('active');
        }
    } catch (err) {
        showToast('Error generating preview', 'error');
    }
}

function closePreview() {
    document.getElementById('preview-modal').classList.remove('active');
}

function generateFromPreview() {
    closePreview();
    generateSite();
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
}

function copySuccessUrl() {
    var url = document.getElementById('success-url').href;
    navigator.clipboard.writeText(url);
    showToast('URL copied to clipboard!', 'success');
}

function copyUrl(url) {
    navigator.clipboard.writeText(url);
    showToast('URL copied!', 'success');
}

async function deleteProperty(slug) {
    if (!confirm('Are you sure you want to delete "' + slug + '"? This cannot be undone.')) {
        return;
    }

    try {
        var res = await fetch('/api/properties/' + slug, {
            method: 'DELETE'
        });
        var data = await res.json();

        if (data.success) {
            showToast('Property deleted successfully', 'success');
            loadProperties(); // Refresh the list
        } else {
            showToast(data.error || 'Error deleting property', 'error');
        }
    } catch (err) {
        showToast('Error deleting property', 'error');
        console.error('Delete error:', err);
    }
}

function clearForm() {
    if (confirm('Are you sure you want to clear the form?')) {
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
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
        toast.remove();
    }, 3000);
}
