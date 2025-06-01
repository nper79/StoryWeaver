// Simple test script to verify the ElevenLabs API key
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

// Load .env file manually since we're using ES modules
config();

// Alternative method to read the .env file directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envContent = fs.readFileSync(`${__dirname}/.env`, 'utf8');
const envLines = envContent.split('\n');
const envVars = {};

envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

// Try both methods to get the API key
const apiKeyFromEnv = process.env.VITE_ELEVENLABS_API_KEY;
const apiKeyFromFile = envVars.VITE_ELEVENLABS_API_KEY;
const apiKey = apiKeyFromEnv || apiKeyFromFile;

console.log('API Key from process.env:', apiKeyFromEnv ? `Found (length: ${apiKeyFromEnv.length})` : 'Not found');
console.log('API Key from file:', apiKeyFromFile ? `Found (length: ${apiKeyFromFile.length})` : 'Not found');
console.log('Using API Key:', apiKey ? `Found (length: ${apiKey.length})` : 'Not found');
console.log('First 5 chars:', apiKey ? apiKey.substring(0, 5) : 'N/A');
console.log('Last 5 chars:', apiKey ? apiKey.substring(apiKey.length - 5) : 'N/A');

// Test the API key with a direct fetch
async function testElevenLabsKey() {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! Found', data.voices.length, 'voices');
    } else {
      const text = await response.text();
      console.error('Error response:', text);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testElevenLabsKey();
