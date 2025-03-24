// Main app.js for S Pen Masking Tool

// Global variables
let baseCanvas, baseCtx;
let maskCanvas, maskCtx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'brush';
let hasBaseImage = false;
let brushSize = 10;
let baseImage = new Image();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Get canvas elements
  baseCanvas = document.getElementById('baseCanvas');
  baseCtx = baseCanvas.getContext('2d');
  maskCanvas = document.getElementById('maskCanvas');
  maskCtx = maskCanvas.getContext('2d');
  
  // Set canvas dimensions
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  
  // Set up tool buttons
  document.getElementById('uploadBtn').addEventListener('click', openUploadModal);
  document.getElementById('brushBtn').addEventListener('click', () => setTool('brush'));
  document.getElementById('eraserBtn').addEventListener('click', () => setTool('eraser'));
  document.getElementById('clearBtn').addEventListener('click', clearMask);
  document.getElementById('inpaintBtn').addEventListener('click', openInpaintModal);
  
  // Set up modals
  setupModals();
  
  // Set up drawing events - optimized for touch/S Pen
  setupDrawingEvents();
  
  // Clear mask initially
  clearMask();
}

// Resize canvases to fill the container
function resizeCanvases() {
  const container = document.querySelector('.canvas-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  baseCanvas.width = width;
  baseCanvas.height = height;
  maskCanvas.width = width;
  maskCanvas.height = height;
  
  // Redraw content after resize
  if (hasBaseImage) {
    redrawBaseImage();
  }
  
  // Set mask canvas styling
  maskCtx.lineCap = 'round';
  maskCtx.lineJoin = 'round';
  maskCtx.strokeStyle = 'white';
}

// Set active tool
function setTool(tool) {
  currentTool = tool;
  
  // Update button active states
  document.querySelectorAll('.tool-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`${tool}Btn`).classList.add('active');
}

// Clear the mask
function clearMask() {
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
}

// Setup drawing events for S Pen/touch
function setupDrawingEvents() {
  // For mobile and S Pen support, use pointer events
  maskCanvas.addEventListener('pointerdown', startDrawing);
  maskCanvas.addEventListener('pointermove', draw);
  maskCanvas.addEventListener('pointerup', stopDrawing);
  maskCanvas.addEventListener('pointerout', stopDrawing);
  maskCanvas.addEventListener('pointercancel', stopDrawing);
  
  // Prevent scrolling while drawing
  maskCanvas.addEventListener('touchstart', e => e.preventDefault());
  maskCanvas.addEventListener('touchmove', e => e.preventDefault());
}

// Start drawing
function startDrawing(e) {
  if (!hasBaseImage) return;
  
  isDrawing = true;
  
  // Get position, accounting for canvas position
  const rect = maskCanvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
  
  // Draw a dot at start position
  maskCtx.beginPath();
  maskCtx.arc(lastX, lastY, brushSize/2, 0, Math.PI * 2);
  
  if (currentTool === 'eraser') {
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'rgba(255,255,255,1)';
  }
  
  maskCtx.fill();
}

// Draw based on pointer movement
function draw(e) {
  if (!isDrawing) return;
  
  // Get S Pen pressure if available
  let pressure = e.pressure !== undefined ? e.pressure : 1;
  // Ensure minimum size
  pressure = Math.max(0.1, pressure);
  
  // Get current position
  const rect = maskCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  // Set line width based on pressure
  maskCtx.lineWidth = brushSize * pressure;
  
  // Set composite operation based on tool
  if (currentTool === 'eraser') {
    maskCtx.globalCompositeOperation = 'destination-out';
  } else {
    maskCtx.globalCompositeOperation = 'source-over';
  }
  
  // Draw line
  maskCtx.beginPath();
  maskCtx.moveTo(lastX, lastY);
  maskCtx.lineTo(currentX, currentY);
  maskCtx.stroke();
  
  // Update last position
  lastX = currentX;
  lastY = currentY;
}

// Stop drawing
function stopDrawing() {
  isDrawing = false;
}

// Setup modals
function setupModals() {
  // Upload modal
  const uploadModal = document.getElementById('uploadModal');
  document.getElementById('uploadBtn').addEventListener('click', () => {
    uploadModal.style.display = 'block';
  });
  
  // Cancel upload
  document.getElementById('cancelUpload').addEventListener('click', () => {
    uploadModal.style.display = 'none';
  });
  
  // Confirm upload
  document.getElementById('confirmUpload').addEventListener('click', uploadImage);
  
  // Inpaint modal
  const inpaintModal = document.getElementById('inpaintModal');
  document.getElementById('inpaintBtn').addEventListener('click', () => {
    inpaintModal.style.display = 'block';
  });
  
  // Cancel inpaint
  document.getElementById('cancelInpaint').addEventListener('click', () => {
    inpaintModal.style.display = 'none';
  });
  
  // Confirm inpaint
  document.getElementById('confirmInpaint').addEventListener('click', submitInpaintRequest);
  
  // Results modal
  const resultsModal = document.getElementById('resultsModal');
  document.getElementById('closeResults').addEventListener('click', () => {
    resultsModal.style.display = 'none';
  });
  
  // Close buttons
  document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });
  
  // Download mask button
  document.getElementById('downloadMask').addEventListener('click', downloadMask);
}

// Open upload modal
function openUploadModal() {
  document.getElementById('uploadModal').style.display = 'block';
}

// Open inpaint modal
function openInpaintModal() {
  if (!hasBaseImage) {
    alert('Please upload an image first');
    return;
  }
  document.getElementById('inpaintModal').style.display = 'block';
}

// Upload image
function uploadImage() {
  const fileInput = document.getElementById('imageUpload');
  if (!fileInput.files || !fileInput.files[0]) {
    alert('Please select an image to upload');
    return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  
  reader.onload = function(e) {
    baseImage.src = e.target.result;
    baseImage.onload = function() {
      // Draw image on base canvas
      redrawBaseImage();
      hasBaseImage = true;
      
      // Enable inpaint button
      document.getElementById('inpaintBtn').disabled = false;
      
      // Clear mask
      clearMask();
      
      // Close modal
      document.getElementById('uploadModal').style.display = 'none';
    };
  };
  
  reader.readAsDataURL(file);
}

// Redraw base image on canvas
function redrawBaseImage() {
  // Clear canvas
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  
  // Calculate proportional sizing
  const canvasRatio = baseCanvas.width / baseCanvas.height;
  const imgRatio = baseImage.width / baseImage.height;
  
  let drawWidth, drawHeight, offsetX, offsetY;
  
  if (canvasRatio > imgRatio) {
    // Canvas is wider than image
    drawHeight = baseCanvas.height;
    drawWidth = baseImage.width * (drawHeight / baseImage.height);
    offsetX = (baseCanvas.width - drawWidth) / 2;
    offsetY = 0;
  } else {
    // Canvas is taller than image
    drawWidth = baseCanvas.width;
    drawHeight = baseImage.height * (drawWidth / baseImage.width);
    offsetX = 0;
    offsetY = (baseCanvas.height - drawHeight) / 2;
  }
  
  // Draw the image
  baseCtx.drawImage(baseImage, offsetX, offsetY, drawWidth, drawHeight);
}

// Submit inpaint request
function submitInpaintRequest() {
  if (!hasBaseImage) {
    alert('Please upload an image first');
    return;
  }
  
  // Get prompt and negative prompt
  const prompt = document.getElementById('prompt').value || 'Realistic photo';
  const negativePrompt = document.getElementById('negativePrompt').value || '';
  
  // Get base64 data from canvases
  const originalImageData = baseCanvas.toDataURL('image/png');
  const maskImageData = maskCanvas.toDataURL('image/png');
  
  // Send to server
  fetch('/api/inpaint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      originalImage: originalImageData,
      maskImage: maskImageData,
      prompt: prompt,
      negativePrompt: negativePrompt
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Show results
      document.getElementById('originalImage').src = data.originalPath;
      document.getElementById('maskImage').src = data.maskPath;
      
      // Hide inpaint modal and show results modal
      document.getElementById('inpaintModal').style.display = 'none';
      document.getElementById('resultsModal').style.display = 'block';
    } else {
      alert('Error: ' + data.message);
    }
  })
  .catch(error => {
    alert('Error submitting request: ' + error.message);
  });
}

// Download mask as PNG
function downloadMask() {
  // Create a temporary link
  const link = document.createElement('a');
  link.download = 'mask-' + Date.now() + '.png';
  link.href = maskCanvas.toDataURL('image/png');
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
