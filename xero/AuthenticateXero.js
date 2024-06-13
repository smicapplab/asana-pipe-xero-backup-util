require('dotenv').config();
const axios = require('axios');
const qs = require('qs');
const readlineSync = require('readline-sync');

// Dynamically import the 'open' package
async function loadOpen() {
  const { default: open } = await import('open');
  return open;
}

const clientId = process.env.XERO_CLIENT_ID;
const clientSecret = process.env.XERO_CLIENT_SECRET;
const redirectUri = process.env.XERO_REDIRECT_URI;
const scope = 'accounting.transactions accounting.settings';

const authUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

// Step 1: Redirect user to Xero authorization URL
const getAuthorizationCode = async (open) => {
  await open(authUrl);
  
  // Wait for the user to provide the authorization code
  const authorizationCode = readlineSync.question('Enter the authorization code from the callback URL: ');
  return authorizationCode;
};

// Step 2: Exchange authorization code for access token
const exchangeAuthorizationCode = async (code) => {
  try {
    const tokenResponse = await axios.post('https://identity.xero.com/connect/token', qs.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token } = tokenResponse.data;
    return { access_token, refresh_token };
  } catch (error) {
    console.error('Error during token exchange:', error);
    throw error;
  }
};

// Step 3: Main function to handle the OAuth flow
const AuthenticateXero = async () => {
  try {
    const open = await loadOpen();
    const authorizationCode = await getAuthorizationCode(open);
    const tokens = await exchangeAuthorizationCode(authorizationCode);
    return tokens;    
  } catch (error) {
    console.error('An error occurred during the OAuth process:', error);
  }
};

module.exports = AuthenticateXero;