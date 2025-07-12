// ***********************************************
// Test Constants and Configuration
// ***********************************************

/**
 * API Endpoints Configuration with Dynamic Functions
 */
export const API_ENDPOINTS = {
  // Base URL helper
  BASE_URL: () => Cypress.env('API_BASE_URL'),
  
  // Authentication endpoints
  AUTH: {
    LOGIN: () => `${Cypress.env('API_BASE_URL')}/auth/login`,
    LOGOUT: () => `${Cypress.env('API_BASE_URL')}/auth/logout`,
    REFRESH: () => `${Cypress.env('API_BASE_URL')}/auth/refresh`
  },
  
  // User endpoints
  USER: {
    PROFILE: () => `${Cypress.env('API_BASE_URL')}/user/profile`,
    UPDATE_PROFILE: () => `${Cypress.env('API_BASE_URL')}/user/profile`
  },
  
  // Wallet endpoints with dynamic parameters
  WALLET: {
    GET_WALLET: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}`,
    PROCESS_TRANSACTION: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/transaction`,
    GET_TRANSACTION: (walletId, transactionId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/transaction/${transactionId}`,
    GET_TRANSACTIONS: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/transactions`,
    GET_BALANCE: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/balance`
  }
};

/**
 * Utility Functions for Validation and Data Generation
 */
export const UTILITY_FUNCTIONS = {
  /**
   * Generate a random UUID v4
   * @returns {string} Generated UUID
   */
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Validate UUID format
   * @param {string} uuid - UUID to validate
   * @returns {boolean} True if valid UUID
   */
  isValidUUID: (uuid) => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(uuid);
  },

  /**
   * Validate ISO date format
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid ISO date
   */
  isValidISODate: (dateString) => {
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return isoDatePattern.test(dateString) && !isNaN(new Date(dateString).getTime());
  },

  /**
   * Calculate expected balance after transactions
   * @param {number} initialBalance - Starting balance
   * @param {Array} completedTransactions - Array of completed transactions
   * @returns {number} Expected final balance
   */
  calculateExpectedBalance: (initialBalance, completedTransactions) => {
    let expectedBalance = initialBalance;
    
    completedTransactions.forEach(transaction => {
      if (transaction.outcome === 'approved') {
        if (transaction.type === 'credit') {
          expectedBalance += transaction.amount;
        } else if (transaction.type === 'debit') {
          expectedBalance -= transaction.amount;
        }
      }
    });
    
    return expectedBalance;
  },

  /**
   * Validate transaction response structure
   * @param {Object} transaction - Transaction object to validate
   * @param {Array} requiredProperties - Required properties to check
   * @returns {boolean} True if valid structure
   */
  validateTransactionStructure: (transaction, requiredProperties = []) => {
    const defaultProperties = ['transactionId', 'status', 'createdAt'];
    const allProperties = [...defaultProperties, ...requiredProperties];
    
    return allProperties.every(prop => transaction.hasOwnProperty(prop));
  },

  /**
   * Generate random transaction amount
   * @param {number} min - Minimum amount
   * @param {number} max - Maximum amount  
   * @param {number} decimals - Number of decimal places
   * @returns {number} Generated amount
   */
  generateRandomAmount: (min = 1, max = 1000, decimals = 2) => {
    const amount = Math.random() * (max - min) + min;
    return parseFloat(amount.toFixed(decimals));
  },

  /**
   * Get current date range for testing
   * @returns {Object} Object with startDate and endDate for today
   */
  getTodayDateRange: () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    return {
      startDate: startOfToday.toISOString(),
      endDate: endOfToday.toISOString()
    };
  },

  /**
   * Validate HTTP status codes
   * @param {number} statusCode - HTTP status code
   * @param {string} category - Category (success, clientError, serverError)
   * @returns {boolean} True if status code is in expected category
   */
  validateStatusCode: (statusCode, category) => {
    const statusRanges = {
      success: [200, 201, 202, 204],
      clientError: (code) => code >= 400 && code < 500,
      serverError: (code) => code >= 500 && code < 600
    };

    if (Array.isArray(statusRanges[category])) {
      return statusRanges[category].includes(statusCode);
    } else if (typeof statusRanges[category] === 'function') {
      return statusRanges[category](statusCode);
    }
    
    return false;
  }
};

/**
 * Test Data Constants
 */
export const TEST_CONSTANTS = {
  CURRENCIES: {
    SUPPORTED: ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF'],
    UNSUPPORTED: ['INVALID', 'XXX', '123', 'ABC'],
    CRYPTO: ['BTC', 'ETH', 'LTC'] // If crypto support is added later
  },
  
  TRANSACTION_TYPES: {
    VALID: ['credit', 'debit'],
    INVALID: ['invalid', 'transfer', 'withdraw', 'deposit']
  },
  
  AMOUNTS: {
    MIN_VALID: 0.01,
    MAX_VALID: 999999.99,
    ZERO: 0,
    NEGATIVE: -100,
    DECIMAL_PLACES: 2,
    TEST_AMOUNTS: {
      SMALL: 10.50,
      MEDIUM: 100.00,
      LARGE: 1000.00,
      VERY_LARGE: 10000.00
    }
  },
  
  STATUS_CODES: {
    SUCCESS: {
      OK: 200,
      CREATED: 201,
      ACCEPTED: 202,
      NO_CONTENT: 204
    },
    CLIENT_ERROR: {
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      METHOD_NOT_ALLOWED: 405,
      CONFLICT: 409,
      UNPROCESSABLE_ENTITY: 422
    },
    SERVER_ERROR: {
      INTERNAL_SERVER_ERROR: 500,
      BAD_GATEWAY: 502,
      SERVICE_UNAVAILABLE: 503,
      GATEWAY_TIMEOUT: 504
    }
  },
  
  TRANSACTION_STATUS: {
    PENDING: 'pending',
    FINISHED: 'finished',
    FAILED: 'failed'
  },
  
  TRANSACTION_OUTCOME: {
    APPROVED: 'approved',
    DENIED: 'denied'
  }
};

/**
 * Test Configuration
 */
export const TEST_CONFIG = {
  TIMEOUTS: {
    SHORT: 5000,      // 5 seconds
    MEDIUM: 10000,    // 10 seconds
    LONG: 30000,      // 30 seconds
    VERY_LONG: 60000, // 1 minute
    API_RESPONSE: 10000,
    TRANSACTION_COMPLETION: 30000,
    AUTHENTICATION: 5000
  },
  
  RETRIES: {
    DEFAULT: 3,
    API_CALLS: 2,
    FLAKY_TESTS: 5
  },
  
  DELAYS: {
    SHORT: 100,   // 100ms
    MEDIUM: 500,  // 500ms
    LONG: 1000,   // 1 second
    RETRY: 1000   // 1 second between retries
  },
  
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    FIRST_PAGE: 1
  },
  
  VALIDATION: {
    BALANCE_TOLERANCE: 0.0001,
    UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ISO_DATE_PATTERN: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  }
};


/**
 * Utility Functions for Configuration
 */
export const ConfigUtils = {
  /**
   * Get environment-specific base URL
   */
  getBaseUrl(environment = 'test') {
    const urls = {
      test: Cypress.env('API_BASE_URL') || 'http://localhost:3000/api',
      staging: Cypress.env('STAGING_API_URL') || 'https://staging-api.example.com',
      production: Cypress.env('PROD_API_URL') || 'https://api.example.com'
    };
    return urls[environment] || urls.test;
  },
  
  /**
   * Build full endpoint URL
   */
  buildEndpointUrl(endpoint, pathParams = {}, baseUrl = null) {
    const base = baseUrl || this.getBaseUrl();
    let url = endpoint;
    
    // Replace path parameters
    Object.keys(pathParams).forEach(param => {
      url = url.replace(`{${param}}`, pathParams[param]);
    });
    
    return `${base}${url}`;
  },
  
  /**
   * Get timeout for specific operation
   */
  getTimeout(operation) {
    return TEST_CONFIG.TIMEOUTS[operation.toUpperCase()] || TEST_CONFIG.TIMEOUTS.MEDIUM;
  },
  
  /**
   * Get retry count for specific operation
   */
  getRetryCount(operation) {
    return TEST_CONFIG.RETRIES[operation.toUpperCase()] || TEST_CONFIG.RETRIES.DEFAULT;
  }
};

// Export all constants as a single object
export const Constants = {
  API_ENDPOINTS,
  UTILITY_FUNCTIONS,
  TEST_CONSTANTS,
  TEST_CONFIG,
  ENVIRONMENT_CONFIG,
  TEST_SCENARIOS,
  ConfigUtils
};

// Export utility functions separately for convenience
export const { 
  generateUUID, 
  isValidUUID, 
  isValidISODate, 
  calculateExpectedBalance,
  validateTransactionStructure,
  generateRandomAmount,
  getTodayDateRange,
  validateStatusCode 
} = UTILITY_FUNCTIONS;

// Default export
export default Constants;
