const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "wallet-api-tests",
  
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: "cypress/screenshots",
  fixturesFolder: "cypress/fixtures",
  
  env: {
    API_BASE_URL: "https://api.wallet.example.com",
    TEST_USERNAME: "test@example.com",
    TEST_PASSWORD: "testPassword123"
  },
  
  retries: {
    runMode: 1,
    openMode: 0
  },
  
  e2e: {
    supportFile: "cypress/support/e2e.js",
    specPattern: "cypress/api/**/*.spec.js",
    
    setupNodeEvents(on, config) {
      require('cypress-mochawesome-reporter/plugin')(on);
      return config;
    },
  },
  
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportPageTitle: 'Wallet API Test Report',
    embeddedScreenshots: true,
    inlineAssets: true,
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true
  }
});