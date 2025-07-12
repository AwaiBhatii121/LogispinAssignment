// ***********************************************
// Test Helper Functions for Wallet API Testing
// ***********************************************

/**
 * Validation Helpers
 */
export const ValidationHelpers = {
  /**
   * Validates UUID format
   * @param {string} uuid - UUID to validate
   * @returns {boolean} - True if valid UUID
   */
  isValidUUID(uuid) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(uuid);
  },

  /**
   * Validates ISO date format
   * @param {string} dateString - Date string to validate
   * @returns {boolean} - True if valid ISO date
   */
  isValidISODate(dateString) {
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (!isoDatePattern.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  },

  /**
   * Validates transaction response structure
   * @param {Object} transaction - Transaction object to validate
   * @param {Array} requiredProperties - Required properties to check
   * @returns {boolean} - True if valid structure
   */
  validateTransactionStructure(transaction, requiredProperties = []) {
    const defaultProperties = ['transactionId', 'status', 'createdAt'];
    const allProperties = [...defaultProperties, ...requiredProperties];
    
    return allProperties.every(prop => transaction.hasOwnProperty(prop));
  }
};

/**
 * Data Generation Helpers
 */
export const DataGenerators = {
  /**
   * Generates a random UUID v4
   * @returns {string} - Generated UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Generates random transaction amount
   * @param {number} min - Minimum amount
   * @param {number} max - Maximum amount
   * @param {number} decimals - Number of decimal places
   * @returns {number} - Generated amount
   */
  generateRandomAmount(min = 1, max = 1000, decimals = 2) {
    const amount = Math.random() * (max - min) + min;
    return parseFloat(amount.toFixed(decimals));
  },

  /**
   * Generates test transaction data
   * @param {Object} overrides - Properties to override
   * @returns {Object} - Transaction data
   */
  generateTransactionData(overrides = {}) {
    const currencies = ['USD', 'EUR', 'GBP', 'CAD'];
    const types = ['credit', 'debit'];
    
    return {
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      amount: this.generateRandomAmount(),
      type: types[Math.floor(Math.random() * types.length)],
      ...overrides
    };
  }
};

/**
 * Date and Time Helpers
 */
export const DateHelpers = {
  /**
   * Gets start of today in ISO format
   * @returns {string} - ISO date string for start of today
   */
  getStartOfToday() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return startOfDay.toISOString();
  },

  /**
   * Gets end of today in ISO format
   * @returns {string} - ISO date string for end of today
   */
  getEndOfToday() {
    const today = new Date();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return endOfDay.toISOString();
  },

  /**
   * Gets date range for testing
   * @param {number} daysAgo - Number of days ago to start from
   * @param {number} daysFromNow - Number of days from now to end at
   * @returns {Object} - Object with startDate and endDate
   */
  getDateRange(daysAgo = 7, daysFromNow = 0) {
    const now = new Date();
    const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const endDate = new Date(now.getTime() + (daysFromNow * 24 * 60 * 60 * 1000));
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }
};

/**
 * Balance Calculation Helpers
 */
export const BalanceHelpers = {
  /**
   * Calculates expected balance after transactions
   * @param {number} initialBalance - Starting balance
   * @param {Array} transactions - Array of completed transactions
   * @returns {number} - Expected final balance
   */
  calculateExpectedBalance(initialBalance, transactions) {
    return transactions.reduce((balance, transaction) => {
      if (transaction.outcome === 'approved') {
        if (transaction.type === 'credit') {
          return balance + transaction.amount;
        } else if (transaction.type === 'debit') {
          return balance - transaction.amount;
        }
      }
      return balance;
    }, initialBalance);
  },

  /**
   * Validates balance is within acceptable range
   * @param {number} actualBalance - Actual balance
   * @param {number} expectedBalance - Expected balance
   * @param {number} tolerance - Acceptable tolerance
   * @returns {boolean} - True if balance is within range
   */
  isBalanceWithinTolerance(actualBalance, expectedBalance, tolerance = 0.01) {
    const difference = Math.abs(actualBalance - expectedBalance);
    return difference <= tolerance;
  }
};

/**
 * API Response Helpers
 */
export const ResponseHelpers = {
  /**
   * Validates HTTP status codes
   * @param {number} statusCode - HTTP status code
   * @param {string} category - Category (success, clientError, serverError)
   * @returns {boolean} - True if status code is in expected category
   */
  validateStatusCode(statusCode, category) {
    const statusRanges = {
      success: [200, 201, 202, 204],
      clientError: range => range >= 400 && range < 500,
      serverError: range => range >= 500 && range < 600
    };

    if (Array.isArray(statusRanges[category])) {
      return statusRanges[category].includes(statusCode);
    } else if (typeof statusRanges[category] === 'function') {
      return statusRanges[category](statusCode);
    }
    
    return false;
  },

  /**
   * Validates response time
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} maxAcceptableTime - Maximum acceptable time
   * @returns {boolean} - True if response time is acceptable
   */
  validateResponseTime(responseTime, maxAcceptableTime = 5000) {
    return responseTime <= maxAcceptableTime;
  }
};

/**
 * Test Configuration Helpers
 */
export const ConfigHelpers = {
  /**
   * Gets environment-specific configuration
   * @param {string} environment - Environment name
   * @returns {Object} - Environment configuration
   */
  getEnvironmentConfig(environment = 'test') {
    const configs = {
      test: {
        timeout: 10000,
        retries: 3,
        baseUrl: Cypress.env('API_BASE_URL') || 'http://localhost:3000/api'
      },
      staging: {
        timeout: 15000,
        retries: 2,
        baseUrl: Cypress.env('STAGING_API_URL') || 'https://staging-api.example.com'
      },
      production: {
        timeout: 20000,
        retries: 1,
        baseUrl: Cypress.env('PROD_API_URL') || 'https://api.example.com'
      }
    };

    return configs[environment] || configs.test;
  }
};

// Export all helpers as a single object for easier importing
export const TestHelpers = {
  validation: ValidationHelpers,
  dataGen: DataGenerators,
  dates: DateHelpers,
  balance: BalanceHelpers,
  response: ResponseHelpers,
  config: ConfigHelpers
};

// Default export for backward compatibility
export default TestHelpers;
