# Wallet API Test Suite - AQA Challenge

## Project Overview
This project provides a comprehensive Cypress API testing framework for the Wallet API system, tailored for the AQA Challenge. It includes automated tests for wallet transaction processing and demonstrates best practices in API test automation.

## Project Structure
```
WalletApiSpec/
├── cypress/
│   ├── api/
│   │   └── wallet.spec.js
│   ├── fixtures/
│   │   └── wallet.json
│   ├── support/
│   │   ├── commands.js
│   │   ├── constants.js
│   │   └── test-helpers.js
├── scripts/
│   └── open-latest-report.js
├── .gitignore
├── cypress.config.js
├── package.json
└── README.md
```

## Setup and Installation
1.  **Prerequisites:**
    *   Node.js (>= 14.0.0)
    *   npm (>= 6.0.0)

2.  **Installation:**
    ```bash
    cd WalletApiSpec
    npm install
    ```

## Running Tests
*   **Run tests in headless mode:**
    ```bash
    npm run test:headless
    ```
*   **Open Cypress Test Runner for interactive testing:**
    ```bash
    npm run open
    ```

## Viewing Test Reports
*   **Open the latest HTML report:**
    ```bash
    npm run report:latest
    ```

## Test Plan
A detailed test plan, including implemented and unimplemented test cases, is available in `docs/TESTPLAN.md`.
