import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.test
function loadEnv() {
  try {
    const envPath = join(__dirname, '../.env.test');
    const envContent = readFileSync(envPath, 'utf-8');

    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.error('Error loading .env.test:', error.message);
  }
}

loadEnv();

export const config = {
  apiUrl: process.env.API_URL,
  testUser: {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
    displayName: process.env.TEST_USER_DISPLAY_NAME,
  },
};
