const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

let serviceAccount;

// Check if we have Firebase config in environment variables
if (process.env.FIREBASE_PROJECT_ID) {
  serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim() 
      : undefined,
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
