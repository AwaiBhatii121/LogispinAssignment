// ***********************************************
// Custom Commands for Wallet API Testing
// ***********************************************

/**
 * Generic HTTP Request Handler
 */
Cypress.Commands.add('sendRequest', ({
  url,
  method = 'GET',
  headers = {},
  queryParameters = {},
  body = null,
  auth = null,
  timeout = 30000,
  failOnStatusCode = false,
  log = true
}) => {
  if (!url) {
    throw new Error('URL is required for sendRequest');
  }

  const options = {
    url,
    method,
    headers,
    qs: queryParameters,
    body,
    failOnStatusCode,
    timeout,
    log
  };

  if (auth) {
    options.auth = auth;
  }

  return cy.request(options);
});
