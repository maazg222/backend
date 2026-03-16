const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

/**
 * Aggressively fixes mangled Firebase private keys (e.g. from Vercel)
 * @param {string} key 
 */
function fixPrivateKey(key) {
  if (!key) return key;
  
  // 1. Remove quotes if they exist
  let fixed = key.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  
  // 2. Replace literal \n with actual newlines
  fixed = fixed.replace(/\\n/g, '\n');
  
  // 3. Remove all characters that are NOT part of a standard PEM (A-Z, a-z, 0-9, +, /, =, -, newline)
  // This cleans up weird backslashes like \pe93UD or other mangling
  fixed = fixed.replace(/[^A-Za-z0-9+/=\-\n ]/g, '');

  // 4. Extract the base64 part and re-format properly
  const match = fixed.match(/-----BEGIN PRIVATE KEY-----([\s\S]*)-----END PRIVATE KEY-----/);
  if (match) {
    const body = match[1].replace(/\s/g, ''); // remove all whitespace from body
    // Reconstruct with 64-char lines as per standard PEM
    const lines = body.match(/.{1,64}/g);
    if (lines) {
      fixed = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  } else if (!fixed.includes('-----BEGIN PRIVATE KEY-----')) {
    // If headers are missing, assume the whole string is the body (not recommended but a last resort)
    const body = fixed.replace(/\s/g, '');
    const lines = body.match(/.{1,64}/g);
    if (lines) {
      fixed = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  }
  
  return fixed;
}

let serviceAccount;

// Check if we have Firebase config in environment variables
if (process.env.FIREBASE_PROJECT_ID) {
  serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: fixPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
  };
} else {
  // Fallback to file for local development if env vars are not set
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  try {
    if (fs.existsSync(keyPath)) {
      const rawData = fs.readFileSync(keyPath);
      serviceAccount = JSON.parse(rawData);
      console.log('Firebase serviceAccountKey.json loaded successfully.');
    } else {
      console.error('Firebase configuration not found in environment variables or serviceAccountKey.json');
    }
  } catch (err) {
    console.error('Error loading serviceAccountKey.json:', err.message);
  }
}

if (serviceAccount) {
  try {
    if (!admin.apps.length) {
      console.log('Attempting to initialize Firebase Admin...');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully.');
    } else {
      console.log('Firebase Admin already initialized.');
    }
  } catch (initErr) {
    console.error('CRITICAL: Firebase initialization failed:', initErr.message);
    console.error('Service account keys present:', Object.keys(serviceAccount).filter(k => !!serviceAccount[k]));
    if (serviceAccount.private_key) {
      const actualKey = serviceAccount.private_key;
      console.log('Private key length:', actualKey.length);
      console.log('Key starts with:', actualKey.substring(0, 30).replace(/\n/g, '\\n'));
      console.log('Key ends with:', actualKey.substring(actualKey.length - 30).replace(/\n/g, '\\n'));
      console.log('Newline count:', (actualKey.match(/\n/g) || []).length);
    }
  }
} else {
  // Fallback or placeholder for initial setup
  console.log('Firebase Admin will not be initialized until serviceAccountKey.json is provided.');
}

const db = (serviceAccount && admin.apps.length > 0) ? admin.firestore() : null;
const auth = (serviceAccount && admin.apps.length > 0) ? admin.auth() : null;

module.exports = { admin, db, auth };
