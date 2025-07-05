import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const port = 3002;

// Initialize OpenAI with API key
const openai = new OpenAI({ 
  apiKey: process.env.VITE_OPENAI_API_KEY 
});

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for handling multipart/form-data
const upload = multer();

// OpenAI API proxy for image generation (GPT Image 1)
app.post('/api/images/generations', upload.any(), async (req, res) => {
  try {
    console.log('[Server] Image generations request received');
    console.log('[Server] Files received:', req.files?.length || 0);
    console.log('[Server] Request body:', JSON.stringify(req.body, null, 2));
    
    // Prepare the request object
    const requestData = {
      model: 'gpt-image-1',
      prompt: req.body.prompt,
      n: parseInt(req.body.n) || 1,
      size: req.body.size || '1024x1024',
      quality: req.body.quality || 'auto'
    };

    // Add reference images if provided
    if (req.files && req.files.length > 0) {
      console.log('[Server] Adding reference images to generation request');
      requestData.image = req.files.map(file => {
        console.log(`[Server] Adding reference image: ${file.originalname} (${file.size} bytes)`);
        return new File([file.buffer], file.originalname, { type: file.mimetype });
      });
    }

    const response = await openai.images.generate(requestData);

    console.log('[Server] Image generations successful');
    res.json(response);
  } catch (error) {
    console.error('[Server] Error in image generations:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// OpenAI API proxy for image editing (GPT Image 1)
app.post('/api/images/edit', upload.single('image'), async (req, res) => {
  try {
    console.log('[Server] Image edit request received');
    console.log('[Server] File received:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'None');
    console.log('[Server] Body params:', Object.keys(req.body));

    if (!process.env.VITE_OPENAI_API_KEY) {
      console.error('[Server] OpenAI API key not found');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.body.prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    console.log('[Server] Calling OpenAI images.edit with gpt-image-1');
    
    // Create a File object from the buffer
    const imageFile = new File([req.file.buffer], req.file.originalname, { 
      type: req.file.mimetype 
    });

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: req.body.prompt,
      size: req.body.size || "1024x1024",
      n: parseInt(req.body.n) || 1,
      response_format: "url"
    });

    console.log('[Server] Image edit successful');
    res.json(response);
  } catch (error) {
    console.error('[Server] Error in image edit:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Translation endpoint
app.post('/api/openai/translate', async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3
    });
    
    const translation = response.choices[0]?.message?.content || '';
    res.json({ translation });
  } catch (error) {
    console.error('[Server] Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    openaiConfigured: !!process.env.VITE_OPENAI_API_KEY
  });
});

app.listen(port, () => {
  console.log(`[Server] API server running on http://localhost:${port}`);
  console.log(`[Server] Health check: http://localhost:${port}/health`);
  console.log(`[Server] OpenAI API Key configured: ${process.env.VITE_OPENAI_API_KEY ? 'Yes' : 'No'}`);
});
