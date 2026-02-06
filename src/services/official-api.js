const axios = require('axios');

const HYDRA_API = process.env.HYDRA_OFFICIAL_API || 'https://hydra-api-us-east-1.losbroxas.org';
const AUTH_URL = 'https://auth.hydra.losbroxas.org';

// Hardcoded for now as requested
const USER_CREDENTIALS = {
  username: '8man',
  password: 'himanshu8443'
};

let cachedToken = null;
let tokenExpiry = null;

class OfficialApi {
  static async getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
      return cachedToken;
    }

    try {
      console.log('Authenticating with Official Hydra API...');
      
      let response;
      try {
        // Correct endpoint discovered: /auth/signin on API domain
        // Headers require Referer
        response = await axios.post(`${HYDRA_API}/auth/signin`, {
          login: USER_CREDENTIALS.username,
          password: USER_CREDENTIALS.password
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://auth.hydra.losbroxas.org/'
          }
        });
      } catch (e1) {
        // Only retry if the primary discovered endpoint fails
        try {
           console.log(`Login on ${HYDRA_API}/auth/signin failed, trying alternate...`);
           // Fallback: try old guess just in case
           response = await axios.post(`${AUTH_URL}/auth/login`, {
            username: USER_CREDENTIALS.username,
            password: USER_CREDENTIALS.password
          });
        } catch (e2) {
           console.error('All login attempts failed');
           throw e1; // Throw the original error which is likely the relevant one
        }
      }

      const { accessToken, expiresIn } = response.data;
      
      if (accessToken) {
        console.log('✓ Successfully authenticated with Official API');
        cachedToken = accessToken;
        // Default to 1 hour if not provided
        const expires = expiresIn || 3600;
        tokenExpiry = Date.now() + (expires * 1000);
        return accessToken;
      }
    } catch (error) {
      console.error('! Failed to authenticate with Official API:', error.message);
      if (error.response) {
        console.error('  URL:', error.config?.url);
        console.error('  Status:', error.response.status);
        console.error('  Data:', typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : JSON.stringify(error.response.data));
      }
    }

    return null;
  }
}

module.exports = OfficialApi;
