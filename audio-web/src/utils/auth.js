/**
 * Get the authentication token from storage
 * @returns {string|null} The authentication token or null if not found
 */
export const getToken = () => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('token') || null;
  }
  return null;
};

// Cache control to limit API calls
let lastAuthCheck = 0;
const AUTH_CACHE_DURATION = 60000; // 1 minute cache

// User cache to avoid redundant API calls
let userCache = null;
let lastUserFetch = 0;
const USER_CACHE_DURATION = 300000; // 5 minute user cache

const SERVER_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Get the current authenticated user
 * @param {boolean} forceRefresh - Whether to force a refresh from the server
 * @returns {Promise<Object|null>} Promise resolving to user object or null if not authenticated
 */
export const getCurrentUser = async (forceRefresh = false) => {
  try {
    // If server-side rendering, return null
    if (typeof window === 'undefined') return null;

    // Check for token first
    const token = getToken();
    if (!token) return null;

    // Check if we're authenticated
    const isAuth = await checkAuthStatus();
    if (!isAuth) return null;

    // Use cached user data if available and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && userCache && now - lastUserFetch < USER_CACHE_DURATION) {
      return userCache;
    }

    // Fetch user data from API
    const response = await fetch(`${SERVER_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const userData = await response.json();
      console.log("get cur user user data: ", userData);

      // Update cache
      userCache = userData;
      lastUserFetch = now;

      return userData;
    } else {
      // If API call fails, clear cache
      userCache = null;

      // Handle unauthorized responses by logging out
      if (response.status === 401) {
        logout();
      }

      return null;
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
};

/**
 * Check authentication status by making a request to backend
 * @returns {Promise<boolean>} Promise resolving to true if authenticated, false otherwise
 */
export const checkAuthStatus = async () => {
  try {
    // If server-side rendering, return false
    if (typeof window === 'undefined') return false;

    // Synchronous check first - if no token, fail fast
    const token = getToken();
    if (!token) {
      sessionStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('username');
      return false;
    }

    // Check if we already have authenticated status in session
    // This helps with new tabs and refreshes
    const storedAuthStatus = sessionStorage.getItem('isAuthenticated') === 'true';

    // Check if we've verified auth recently to avoid excessive API calls
    const now = Date.now();
    const shouldUseCache = now - lastAuthCheck < AUTH_CACHE_DURATION;

    if (storedAuthStatus) {
      if (shouldUseCache) {
        // Use cached result - no server call needed
        console.log("Using cached auth status");
        return true;
      }

      // Cache expired, validate in background but return quickly
      validateTokenAsync(token);
      return true;
    }

    // If we don't have a stored status, do a full server check
    return await validateTokenAsync(token);
  } catch (error) {
    console.error('Error checking authentication:', error);
    // In case of error, fall back to session storage if possible
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('isAuthenticated') === 'true';
    }
    return false;
  }
};

/**
 * Helper function to validate token with the server
 * @param {string} token - The authentication token to validate
 * @returns {Promise<boolean>} Promise resolving to true if token is valid
 */
const validateTokenAsync = async (token) => {
  try {
    // Update the last check timestamp
    lastAuthCheck = Date.now();

    const response = await fetch(`${SERVER_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      // User is authenticated
      const userData = await response.json();

      // Store minimal user info in sessionStorage
      sessionStorage.setItem('isAuthenticated', 'true');
      if (userData.username) {
        sessionStorage.setItem('username', userData.username);
      }

      // Update user cache
      userCache = userData;
      lastUserFetch = Date.now();

      // Only dispatch login event if authentication state changed
      if (sessionStorage.getItem('_authDispatchedEvent') !== 'true') {
        sessionStorage.setItem('_authDispatchedEvent', 'true');
        const loginEvent = new Event('login');
        window.dispatchEvent(loginEvent);
      }

      return true;
    } else {
      // User is not authenticated
      console.error('Authentication failed:', await response.text());
      sessionStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('_authDispatchedEvent');
      userCache = null;
      return false;
    }
  } catch (error) {
    console.error('Error validating token:', error);
    userCache = null;
    return false;
  }
};

/**
 * Add authorization headers to fetch options
 * @param {Object} options - The fetch options object
 * @returns {Object} The fetch options with authorization headers
 */
export const withAuth = (options = {}) => {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return {
    ...options,
    headers,
  };
};

/**
 * Authenticated fetch wrapper
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise} The fetch promise
 */
export const authFetch = (url, options = {}) => {
  return fetch(url, withAuth(options));
};

/**
 * Check if the user is authenticated (synchronous version)
 * @returns {boolean} True if the user is authenticated
 */
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return !!getToken() && sessionStorage.getItem('isAuthenticated') === 'true';
};

/**
 * Log out the user by removing auth data from storage
 */
export const logout = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('_authDispatchedEvent');

    // Reset caches and timestamps
    lastAuthCheck = 0;
    userCache = null;
    lastUserFetch = 0;

    // Dispatch logout event
    const event = new Event('logout');
    window.dispatchEvent(event);
  }
};