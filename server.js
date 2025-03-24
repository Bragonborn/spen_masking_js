const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Create Express app
const app = express();
const port = process.env.PORT || 8080;

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to save base64 image data
app.post('/api/save-image', (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ success: false, message: 'No image data provided' });
    }

    // Extract the base64 data
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a unique filename
    const filename = 'img-' + Date.now() + '.png';
    const filepath = path.join(__dirname, 'uploads', filename);
    
    // Save the image
    fs.writeFileSync(filepath, buffer);
    
    res.json({ 
      success: true, 
      filename: filename,
      path: '/uploads/' + filename
    });
  } catch (error) {
    console.error('Error saving image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// RunPod API integration
app.post('/api/inpaint', async (req, res) => {
  try {
    const { originalImage, maskImage, prompt, negativePrompt } = req.body;
    
    if (!originalImage || !maskImage) {
      return res.status(400).json({ success: false, message: 'Missing required images' });
    }

    // For alpha version: just save the images locally and return success
    // In production, you would send to RunPod API
    
    // Save original image
    const origBase64 = originalImage.replace(/^data:image\/\w+;base64,/, '');
    const origBuffer = Buffer.from(origBase64, 'base64');
    const origFilename = 'original-' + Date.now() + '.png';
    const origFilepath = path.join(__dirname, 'uploads', origFilename);
    fs.writeFileSync(origFilepath, origBuffer);
    
    // Save mask image
    const maskBase64 = maskImage.replace(/^data:image\/\w+;base64,/, '');
    const maskBuffer = Buffer.from(maskBase64, 'base64');
    const maskFilename = 'mask-' + Date.now() + '.png';
    const maskFilepath = path.join(__dirname, 'uploads', maskFilename);
    fs.writeFileSync(maskFilepath, maskBuffer);
    
    // For alpha testing, we'll return success with paths to the saved files
    res.json({
      success: true,
      message: 'Images saved successfully',
      originalPath: '/uploads/' + origFilename,
      maskPath: '/uploads/' + maskFilename,
      prompt: prompt || '',
      negativePrompt: negativePrompt || ''
    });
    
    // The RunPod API call would look something like this:
    /*
    const response = await axios.post(`https://api.runpod.io/v2/${process.env.RUNPOD_ENDPOINT_ID}/run`, {
      input: {
        image: originalImage,
        mask: maskImage,
        prompt: prompt || 'Realistic photo',
        negative_prompt: negativePrompt || 'blurry, distorted',
        num_inference_steps: 30,
        guidance_scale: 7.5
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
      }
    });
    
    res.json(response.data);
    */
    
  } catch (error) {
    console.error('Error in inpainting process:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get list of saved images
app.get('/api/images', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)){
      fs.mkdirSync(uploadsDir, { recursive: true });
      return res.json({ success: true, images: [] });
    }
    
    const files = fs.readdirSync(uploadsDir);
    
    const images = files
      .filter(file => file.startsWith('original-'))
      .map(file => {
        return {
          filename: file,
          path: '/uploads/' + file,
          date: fs.statSync(path.join(uploadsDir, file)).mtime
        };
      })
      .sort((a, b) => b.date - a.date);
    
    res.json({ success: true, images });
  } catch (error) {
    console.error('Error getting image list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Access from another device using your IP address`);
});
