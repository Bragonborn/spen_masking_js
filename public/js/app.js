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
const MASK_OPACITY = 0.5; // Constant mask opacity of 50%

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log("Initializing app...");
  
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
  document.getElementById('fillBtn').addEventListener('click', () => setTool('fill'));
  document.getElementById('clearBtn').addEventListener('click', clearMask);
  document.getElementById('inpaintBtn').addEventListener('click', openInpaintModal);
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  
  // Set up modals
  setupModals();
  
  // Set up drawing events - optimized for touch/S Pen
  setupDrawingEvents();
  
  // Clear mask initially
  clearMask();
  
  // Add brush size slider
  const brushSizeSlider = document.getElementById('brushSizeSlider');
  if (brushSizeSlider) {
    brushSizeSlider.addEventListener('input', function() {
      brushSize = parseInt(this.value);
      document.getElementById('brushSizeValue').textContent = brushSize;
    });
  }
  
  // Make sure the download button is wired up
  const downloadButton = document.getElementById('downloadMask');
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadMaskImage);
    console.log("Download button listener attached");
  }
}

// Resize canvases to fill the container
function resizeCanvases() {
  const container = document.querySelector('.canvas-container');
  let width = container.clientWidth;
  let height = container.clientHeight;
  
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
  maskCtx.strokeStyle = `rgba(255,255,255,${MASK_OPACITY})`;
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
  maskCanvas.addEventListener('pointerdown', handlePointerDown);
  maskCanvas.addEventListener('pointermove', handlePointerMove);
  maskCanvas.addEventListener('pointerup', handlePointerUp);
  maskCanvas.addEventListener('pointerout', handlePointerUp);
  maskCanvas.addEventListener('pointercancel', handlePointerUp);
  
  // Prevent scrolling while drawing
  maskCanvas.addEventListener('touchstart', e => e.preventDefault());
  maskCanvas.addEventListener('touchmove', e => e.preventDefault());
}

// Handle pointer down event based on current tool
function handlePointerDown(e) {
  if (!hasBaseImage) return;
  
  const rect = maskCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (currentTool === 'fill') {
    // Fill tool
    performFill(x, y);
  } else {
    // Brush or eraser
    isDrawing = true;
    lastX = x;
    lastY = y;
    
    // Draw a dot at start position
    maskCtx.beginPath();
    maskCtx.arc(lastX, lastY, brushSize/2, 0, Math.PI * 2);
    
    if (currentTool === 'eraser') {
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      maskCtx.globalCompositeOperation = 'source-over';
      maskCtx.fillStyle = `rgba(255,255,255,${MASK_OPACITY})`; // Constant opacity
    }
    
    maskCtx.fill();
  }
}

// Handle pointer move event for drawing
function handlePointerMove(e) {
  if (!isDrawing) return;
  
  // Get S Pen pressure if available
  let pressure = e.pressure !== undefined ? e.pressure : 1;
  // Ensure minimum size
  pressure = Math.max(0.1, pressure);
  
  // Get current position
  const rect = maskCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  // Set line width based on pressure - only pressure affects size, not opacity
  maskCtx.lineWidth = brushSize * pressure;
  
  // Set composite operation based on tool
  if (currentTool === 'eraser') {
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.strokeStyle = `rgba(255,255,255,${MASK_OPACITY})`; // Constant opacity
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

// Handle pointer up event
function handlePointerUp() {
  isDrawing = false;
}

// Fill tool implementation
function performFill(startX, startY) {
  if (!hasBaseImage) return;
  
  // Create a temporary canvas for processing
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = maskCanvas.width;
  tempCanvas.height = maskCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Copy current mask to temp canvas
  tempCtx.drawImage(maskCanvas, 0, 0);
  
  // Get image data for processing
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Get the color at the clicked position
  const targetPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
  const targetR = data[targetPos];
  const targetG = data[targetPos + 1];
  const targetB = data[targetPos + 2];
  const targetA = data[targetPos + 3];
  
  // Define the fill color (white with 50% opacity)
  const fillR = 255;
  const fillG = 255;
  const fillB = 255;
  const fillA = 255 * MASK_OPACITY;
  
  // Don't fill if already filled
  if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;
  
  // Stack-based flood fill
  const stack = [];
  stack.push([Math.floor(startX), Math.floor(startY)]);
  
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const pos = (y * width + x) * 4;
    
    // Check if this pixel matches the target color
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (data[pos] !== targetR || data[pos + 1] !== targetG || 
        data[pos + 2] !== targetB || data[pos + 3] !== targetA) continue;
    
    // Fill this pixel
    data[pos] = fillR;
    data[pos + 1] = fillG;
    data[pos + 2] = fillB;
    data[pos + 3] = fillA;
    
    // Add neighboring pixels to stack
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  // Apply the filled result
  tempCtx.putImageData(imageData, 0, 0);
  
  // Draw the result to the main mask canvas
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.drawImage(tempCanvas, 0, 0);
}

// Setup modals
function setupModals() {
  // Upload modal
  const uploadModal = document.getElementById('uploadModal');
  
  // Cancel upload
  document.getElementById('cancelUpload').addEventListener('click', () => {
    uploadModal.style.display = 'none';
  });
  
  // Confirm upload
  document.getElementById('confirmUpload').addEventListener('click', uploadImage);
  
  // Inpaint modal
  const inpaintModal = document.getElementById('inpaintModal');
  
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
  
  // Settings modal
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    document.getElementById('closeSettings').addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }
  
  // Close buttons
  document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });
  
  // Download mask button - ensure it's properly attached
  const downloadBtn = document.getElementById('downloadMask');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadMaskImage);
    console.log("Download button listener attached");
  }
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

// Open settings modal
function openSettingsModal() {
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.style.display = 'block';
  }
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

// Redraw base image on canvas (simplified, no aspect ratio warping)
function redrawBaseImage() {
  // Clear canvas
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  
  // Calculate proportional sizing to fit within canvas
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
  
  // For actual submission, we need a non-transparent mask
  // Create a temporary canvas to make mask fully opaque
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = maskCanvas.width;
  tempCanvas.height = maskCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Draw the mask with full opacity
  tempCtx.fillStyle = 'black';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.globalCompositeOperation = 'source-over';
  tempCtx.drawImage(maskCanvas, 0, 0);
  
  // Get base64 data from canvases
  const originalImageData = baseCanvas.toDataURL('image/png');
  const maskImageData = tempCanvas.toDataURL('image/png');
  
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
function downloadMaskImage() {
  console.log("Downloading mask...");
  
  // Create a temporary canvas to make mask fully opaque
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = maskCanvas.width;
  tempCanvas.height = maskCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Draw the mask with full opacity
  tempCtx.fillStyle = 'black';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.globalCompositeOperation = 'source-over';
  tempCtx.drawImage(maskCanvas, 0, 0);
  
  // Create a temporary link
  const link = document.createElement('a');
  link.download = 'mask-' + Date.now() + '.png';
  link.href = tempCanvas.toDataURL('image/png');
  
  // Log for debugging
  console.log("Download link created:", link.href.substring(0, 100) + "...");
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log("Download initiated");
}
