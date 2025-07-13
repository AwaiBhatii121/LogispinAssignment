export const API_ENDPOINTS = {
  BASE_URL: () => Cypress.env('API_BASE_URL'),
  
  AUTH: {
    LOGIN: () => `${Cypress.env('API_BASE_URL')}/user/login`,
    LOGOUT: () => `${Cypress.env('API_BASE_URL')}/user/logout`,
    REFRESH: () => `${Cypress.env('API_BASE_URL')}/user/refresh`
  },
  
  USER: {
    PROFILE: (userId) => `${Cypress.env('API_BASE_URL')}/user/info/${userId}`,
    UPDATE_PROFILE: (userId) => `${Cypress.env('API_BASE_URL')}/user/info/${userId}`
  },
  
  WALLET: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}`,
  WALLET_TRANSACTION: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/transaction`,
  TRANSACTION_DETAIL: (walletId, transactionId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/transaction/${transactionId}`,
  WALLET_TRANSACTIONS: (walletId) => `${Cypress.env('API_BASE_URL')}/wallet/${walletId}/transactions`
};