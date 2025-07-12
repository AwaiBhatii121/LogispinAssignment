import {
  API_ENDPOINTS,
  generateUUID,
  isValidUUID,
  isValidISODate,
  calculateExpectedBalance,
  validateTransactionStructure,
  getTodayDateRange
} from '../support/constants';

describe('Wallet API Transaction Processing', () => {
  let walletId;
  let authToken;
  let userId;
  let testData;

  before(() => {
    // Load test data from fixtures
    cy.fixture('wallet').then((data) => {
      testData = data;

      // Authentication using fixture data and sendRequest
      return cy.sendRequest({
        url: API_ENDPOINTS.AUTH.LOGIN(),
        method: 'POST',
        headers: testData.commonTestData.testConfiguration.defaultHeaders,
        body: {
          username: Cypress.env('TEST_USERNAME'),
          password: Cypress.env('TEST_PASSWORD')
        },
        failOnStatusCode: true
      });
    }).then((response) => {
      expect(response.status).to.equal(200);
      authToken = response.body.token;
      userId = response.body.userId;

      // Get user info using sendRequest
      return cy.sendRequest({
        url: API_ENDPOINTS.USER.PROFILE(),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        failOnStatusCode: true
      });
    }).then((response) => {
      expect(response.status).to.equal(200);
      walletId = response.body.walletId;
    });
  });

  beforeEach(() => {
    // Ensure authentication is available for each test
    Cypress.env('authToken', authToken);
    Cypress.env('userId', userId);
    Cypress.env('walletId', walletId);
  });

  /**
   * Test Case 1: Process Successful Credit Transaction
   * Priority: High
   * 
   * Validates that the API can process a basic credit transaction
   * and return the correct response structure
   */
  describe('TC01: Process Successful Credit Transaction', () => {
    it('should successfully process a credit transaction and return transaction details', () => {
      const testCase = testData.testCases.TC01_successfulCreditTransaction;

      // Act - Process transaction using sendRequest
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        body: testCase.transactionData,
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: true
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201, 202]);
        const result = response.body;

        // Assert response structure using utility function
        expect(validateTransactionStructure(result, testCase.expectedResponse.properties)).to.be.true;
        expect(isValidUUID(result.transactionId)).to.be.true;
        expect(result.status).to.match(new RegExp(testCase.expectedResponse.statusPattern));
        expect(isValidISODate(result.createdAt)).to.be.true;

        // If transaction is finished immediately, check outcome
        if (result.status === 'finished') {
          expect(result).to.have.property('outcome');
          expect(result.outcome).to.match(new RegExp(testCase.expectedResponse.outcomePattern));
        }

        // Verify transaction can be retrieved using sendRequest
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, result.transactionId),
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: true
        }).then((getResponse) => {
          expect(getResponse.status).to.equal(200);
          const retrievedTransaction = getResponse.body;
          expect(retrievedTransaction.transactionId).to.equal(result.transactionId);
          expect(retrievedTransaction.currency).to.equal(testCase.transactionData.currency);
          expect(retrievedTransaction.amount).to.equal(testCase.transactionData.amount);
          expect(retrievedTransaction.type).to.equal(testCase.transactionData.type);
        });
      });
    });
  });

  /**
   * Test Case 2: Process Debit Transaction with Sufficient Balance
   * Priority: High
   * 
   * Validates that debit transactions work correctly when sufficient balance exists
   */
  describe('TC02: Process Debit Transaction with Sufficient Balance', () => {
    it('should successfully process a debit transaction when balance is sufficient', () => {
      const testCase = testData.testCases.TC02_debitTransactionSufficientBalance;

      // Arrange - First add funds to ensure sufficient balance using sendRequest
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        body: testCase.setupTransaction,
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: true
      }).then((creditResponse) => {
        expect(creditResponse.status).to.be.oneOf([200, 201, 202]);
        const creditResult = creditResponse.body;

        // Wait for credit transaction to complete if pending
        const waitForCompletion = (transactionId) => {
          return cy.sendRequest({
            url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.commonTestData.testConfiguration.defaultHeaders
            },
            timeout: testData.testConfiguration.timeouts.apiResponse,
            failOnStatusCode: true
          }).then((response) => {
            const transaction = response.body;
            if (transaction.status === 'finished') {
              return transaction;
            }

            cy.wait(testData.testConfiguration.retryConfig.retryDelay);
            return waitForCompletion(transactionId);
          });
        };

        if (creditResult.status === 'pending') {
          return waitForCompletion(creditResult.transactionId);
        }
        return creditResult;
      }).then((completedCredit) => {
        // Assumption: Credit transaction is approved for this test to proceed
        expect(completedCredit.outcome).to.equal(testCase.expectedOutcome);

        // Act - Process debit transaction using sendRequest
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          body: testCase.mainTransaction,
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: true
        }).then((debitResponse) => {
          expect(debitResponse.status).to.be.oneOf([200, 201, 202]);
          const debitResult = debitResponse.body;

          // Assert using utility functions
          expect(debitResult).to.have.property('transactionId');
          expect(debitResult).to.have.property('status');
          expect(isValidUUID(debitResult.transactionId)).to.be.true;

          // Wait for completion and verify outcome
          const waitForDebitCompletion = (transactionId) => {
            return cy.sendRequest({
              url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                ...testData.commonTestData.testConfiguration.defaultHeaders
              },
              timeout: testData.testConfiguration.timeouts.apiResponse,
              failOnStatusCode: true
            }).then((response) => {
              const transaction = response.body;
              if (transaction.status === 'finished') {
                return transaction;
              }

              cy.wait(testData.testConfiguration.retryConfig.retryDelay);
              return waitForDebitCompletion(transactionId);
            });
          };

          if (debitResult.status === 'pending') {
            return waitForDebitCompletion(debitResult.transactionId);
          }
          return debitResult;
        }).then((completedDebit) => {
          expect(completedDebit.status).to.equal('finished');
          expect(completedDebit.outcome).to.equal(testCase.expectedOutcome);
        });
      });
    });
  });

  /**
   * Test Case 3: Handle Pending Transaction Completion
   * Priority: High
   * 
   * Validates the system's handling of transactions that take longer than 1 second
   */
  describe('TC03: Handle Pending Transaction Completion', () => {
    it('should handle pending transactions and eventual completion', () => {
      const testCase = testData.testCases.TC03_pendingTransactionCompletion;

      // Act - Process transaction using sendRequest
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        body: testCase.transactionData,
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: true
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201, 202]);
        const result = response.body;

        // Assert initial response using utility functions
        testCase.expectedResponse.properties.forEach(property => {
          if (property !== 'updatedAt') { // updatedAt only exists after completion
            expect(result).to.have.property(property);
          }
        });
        expect(isValidUUID(result.transactionId)).to.be.true;

        // If transaction is pending, wait for completion using sendRequest
        const waitForTransactionCompletion = (transactionId) => {
          return cy.sendRequest({
            url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.commonTestData.testConfiguration.defaultHeaders
            },
            timeout: testData.testConfiguration.timeouts.apiResponse,
            failOnStatusCode: true
          }).then((response) => {
            const transaction = response.body;
            if (transaction.status === 'finished') {
              return transaction;
            }

            cy.wait(testData.testConfiguration.retryConfig.retryDelay);
            return waitForTransactionCompletion(transactionId);
          });
        };

        if (result.status === 'pending') {
          return waitForTransactionCompletion(result.transactionId);
        }
        return result;
      }).then((completedTransaction) => {
        expect(completedTransaction.status).to.equal(testCase.expectedResponse.finalStatus);
        expect(completedTransaction.outcome).to.match(new RegExp(testCase.expectedResponse.outcomePattern));
        expect(completedTransaction).to.have.property('updatedAt');
        expect(isValidISODate(completedTransaction.updatedAt)).to.be.true;

        // Verify transaction details are complete using sendRequest
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, completedTransaction.transactionId),
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: true
        }).then((finalResponse) => {
          const finalTransaction = finalResponse.body;
          expect(finalTransaction.currency).to.equal(testCase.transactionData.currency);
          expect(finalTransaction.amount).to.equal(testCase.transactionData.amount);
          expect(finalTransaction.type).to.equal(testCase.transactionData.type);
        });
      });
    });
  });

  /**
   * Test Case 4: Multi-Currency Transaction Processing
   * Priority: Medium
   * 
   * Validates multi-currency support and currency clip creation
   */
  describe('TC04: Multi-Currency Transaction Processing', () => {
    it('should process transactions in multiple currencies and create currency clips', () => {
      const testCase = testData.testCases.TC04_multiCurrencyTransactions;
      const transactionPromises = [];

      // Arrange - Create transactions for each currency using sendRequest
      testCase.currencies.forEach(currency => {
        const transactionData = {
          currency,
          amount: testCase.transactionTemplate.amount,
          type: testCase.transactionTemplate.type
        };

        const transactionPromise = cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          body: transactionData,
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: true
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 201, 202]);
          return response.body;
        });

        transactionPromises.push(transactionPromise);
      });

      // Act
      Promise.all(transactionPromises).then((results) => {
        // Assert
        expect(results).to.have.length(testCase.currencies.length);
        results.forEach((result) => {
          expect(result).to.have.property('transactionId');
          expect(result).to.have.property('status');
          expect(isValidUUID(result.transactionId)).to.be.true;
        });

        // Wait for all transactions to complete
        const completionPromises = results.map(result => {
          if (result.status === 'pending') {
            const waitForCompletion = (transactionId) => {
              return cy.sendRequest({
                url: API_ENDPOINTS.TRANSACTION_DETAIL(walletId, transactionId),
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  ...testData.commonTestData.testConfiguration.defaultHeaders
                },
                timeout: testData.testConfiguration.timeouts.apiResponse,
                failOnStatusCode: true
              }).then((response) => {
                const transaction = response.body;
                if (transaction.status === 'finished') {
                  return transaction;
                }

                cy.wait(testData.testConfiguration.retryConfig.retryDelay);
                return waitForCompletion(transactionId);
              });
            };
            return waitForCompletion(result.transactionId);
          }
          return Promise.resolve(result);
        });

        Promise.all(completionPromises).then((completedTransactions) => {
          const approvedTransactions = completedTransactions.filter(t => t.outcome === 'approved');

          // Verify wallet now has currency clips for approved currencies using sendRequest
          cy.sendRequest({
            url: API_ENDPOINTS.WALLET(walletId),
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.commonTestData.testConfiguration.defaultHeaders
            },
            timeout: testData.testConfiguration.timeouts.apiResponse,
            failOnStatusCode: true
          }).then((walletResponse) => {
            expect(walletResponse.status).to.equal(200);
            const wallet = walletResponse.body;
            expect(wallet.currencyClips).to.have.length.greaterThan(testCase.expectedWalletProperties.currencyClips.minLength - 1);

            // Verify each approved currency has a corresponding clip
            approvedTransactions.forEach(transaction => {
              cy.sendRequest({
                url: API_ENDPOINTS.TRANSACTION_DETAIL(walletId, transaction.transactionId),
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  ...testData.commonTestData.testConfiguration.defaultHeaders
                },
                timeout: testData.testConfiguration.timeouts.apiResponse,
                failOnStatusCode: true
              }).then((transactionResponse) => {
                const transactionDetails = transactionResponse.body;
                const currencyClip = wallet.currencyClips.find(clip => clip.currency === transactionDetails.currency);
                if (currencyClip) {
                  testCase.expectedWalletProperties.currencyClips.properties.forEach(property => {
                    expect(currencyClip).to.have.property(property);
                  });
                  expect(currencyClip.balance).to.be.greaterThan(0);
                  expect(currencyClip.transactionCount).to.be.greaterThan(0);
                }
              });
            });
          });
        });
      });
    });
  });

  /**
   * Test Case 5: Transaction Input Validation
   * Priority: Medium
   * 
   * Tests various invalid input scenarios to ensure proper validation
   */
  describe('TC05: Transaction Input Validation', () => {
    it('should reject invalid transaction requests', () => {
      const testCase = testData.testCases.TC05_inputValidation;
      const invalidTransactions = Object.values(testCase.invalidTransactions);

      // Act & Assert - Use sendRequest for error scenarios
      invalidTransactions.forEach((invalidTransaction) => {
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          body: invalidTransaction,
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.greaterThan(testCase.expectedErrorStatus.minStatus - 1);
        });
      });
    });

    it('should reject transactions with invalid amounts', () => {
      const testCase = testData.testCases.TC05_inputValidation;
      const invalidAmountTransactions = [
        testCase.invalidTransactions.zeroAmount,
        testCase.invalidTransactions.negativeAmount
      ];

      // Act & Assert - Use sendRequest for error scenarios
      invalidAmountTransactions.forEach((invalidTransaction) => {
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          body: invalidTransaction,
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.greaterThan(testCase.expectedErrorStatus.minStatus - 1);
        });
      });
    });
  });

  /**
   * Test Case 6: Wallet Balance Consistency
   * Priority: High
   * 
   * Validates that wallet balance remains consistent after multiple transactions
   */
  describe('TC06: Wallet Balance Consistency', () => {
    it('should maintain consistent balance across multiple transactions', () => {
      const testCase = testData.testCases.TC06_balanceConsistency;

      // Get initial wallet state using sendRequest
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET(walletId),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: true
      }).then((walletResponse) => {
        expect(walletResponse.status).to.equal(200);
        const initialWallet = walletResponse.body;
        const initialClip = initialWallet.currencyClips.find(clip => clip.currency === testCase.currency);
        const initialBalance = initialClip ? initialClip.balance : 0;

        // Act - Process multiple transactions sequentially using sendRequest
        const processTransactionsSequentially = (transactionList, results = []) => {
          if (transactionList.length === 0) {
            return Promise.resolve(results);
          }

          const [currentTransaction, ...remainingTransactions] = transactionList;
          return cy.sendRequest({
            url: API_ENDPOINTS.WALLET_TRANSACTION(walletId),
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.commonTestData.testConfiguration.defaultHeaders
            },
            body: currentTransaction,
            timeout: testData.testConfiguration.timeouts.apiResponse,
            failOnStatusCode: true
          }).then((response) => {
            expect(response.status).to.be.oneOf([200, 201, 202]);
            results.push(response.body);
            return processTransactionsSequentially(remainingTransactions, results);
          });
        };

        return processTransactionsSequentially(testCase.transactions).then((results) => {
          // Wait for all transactions to complete
          const completionPromises = results.map(result => {
            if (result.status === 'pending') {
              const waitForCompletion = (transactionId) => {
                return cy.sendRequest({
                  url: API_ENDPOINTS.TRANSACTION_DETAIL(walletId, transactionId),
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${authToken}`,
                    ...testData.commonTestData.testConfiguration.defaultHeaders
                  },
                  timeout: testData.testConfiguration.timeouts.apiResponse,
                  failOnStatusCode: true
                }).then((response) => {
                  const transaction = response.body;
                  if (transaction.status === 'finished') {
                    return transaction;
                  }

                  cy.wait(testData.testConfiguration.retryConfig.retryDelay);
                  return waitForCompletion(transactionId);
                });
              };
              return waitForCompletion(result.transactionId);
            }
            return Promise.resolve(result);
          });

          return Promise.all(completionPromises).then((completedTransactions) => {
            // Assert - Calculate expected balance
            const expectedBalance = calculateExpectedBalance(initialBalance, completedTransactions);

            // Verify final balance using sendRequest
            cy.sendRequest({
              url: API_ENDPOINTS.WALLET(walletId),
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                ...testData.commonTestData.testConfiguration.defaultHeaders
              },
              timeout: testData.testConfiguration.timeouts.apiResponse,
              failOnStatusCode: true
            }).then((finalWalletResponse) => {
              expect(finalWalletResponse.status).to.equal(200);
              const finalWallet = finalWalletResponse.body;
              const finalClip = finalWallet.currencyClips.find(clip => clip.currency === testCase.currency);

              if (finalClip) {
                expect(finalClip.balance).to.be.closeTo(expectedBalance, testCase.balanceValidation.tolerance);
                expect(finalClip.balance).to.be.greaterThanOrEqual(testCase.balanceValidation.minBalance);
              }
            });
          });
        });
      });
    });
  });

  /**
   * Test Case 7: Transaction History Retrieval
   * Priority: Medium
   * 
   * Validates transaction history retrieval with pagination and filtering
   */
  describe('TC07: Transaction History Retrieval', () => {
    it('should retrieve transaction history with proper pagination', () => {
      const testCase = testData.testCases.TC07_transactionHistory;

      // Arrange - Create some transactions first using sendRequest
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        body: testCase.testTransaction,
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: true
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201, 202]);

        // Act - Get transactions with pagination using sendRequest
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET_TRANSACTIONS(walletId),
          method: 'GET',
          queryParameters: testCase.paginationTest,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.commonTestData.testConfiguration.defaultHeaders
          },
          timeout: testData.testConfiguration.timeouts.apiResponse,
          failOnStatusCode: true
        }).then((transactionsResponse) => {
          expect(transactionsResponse.status).to.equal(200);
          const transactions = transactionsResponse.body;

          // Assert
          testCase.expectedHistoryProperties.properties.forEach(property => {
            expect(transactions).to.have.property(property);
          });
          expect(transactions.transactions).to.be.an(testCase.expectedHistoryProperties.transactionsType);
          expect(transactions.currentPage).to.equal(testCase.paginationTest.page);
          expect(transactions.totalCount).to.be.greaterThan(0);
        });
      });
    });

    it('should filter transactions by date range', () => {
      const testCase = testData.testCases.TC07_transactionHistory;

      // Arrange
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const dateFilter = {
        startDate: startOfToday.toISOString(),
        endDate: endOfToday.toISOString()
      };

      // Act - Get transactions with date filter using sendRequest
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET_TRANSACTIONS(walletId),
        method: 'GET',
        queryParameters: dateFilter,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: true
      }).then((transactionsResponse) => {
        expect(transactionsResponse.status).to.equal(200);
        const transactions = transactionsResponse.body;

        // Assert
        expect(transactions).to.have.property('transactions');
        expect(transactions.transactions).to.be.an('array');

        // Verify all transactions are within the date range
        transactions.transactions.forEach(transaction => {
          const transactionDate = new Date(transaction.createdAt);
          expect(transactionDate.getTime()).to.be.greaterThanOrEqual(startOfToday.getTime());
          expect(transactionDate.getTime()).to.be.lessThanOrEqual(endOfToday.getTime());
        });
      });
    });
  });

  /**
   * Test Case 8: Error Handling for Non-existent Resources
   * Priority: Medium
   * 
   * Validates proper error handling for invalid wallet and transaction IDs
   */
  describe('TC08: Error Handling for Non-existent Resources', () => {
    it('should handle requests for non-existent wallet gracefully', () => {
      const testCase = testData.testCases.TC08_errorHandling;

      // Arrange - Generate non-existent wallet ID
      const nonExistentWalletId = generateUUID();

      // Act & Assert - Use sendRequest for error scenarios
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET(nonExistentWalletId),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.greaterThan(testCase.expectedErrorStatus.minStatus - 1);
      });
    });

    it('should handle requests for non-existent transaction gracefully', () => {
      const testCase = testData.testCases.TC08_errorHandling;

      // Arrange - Generate non-existent transaction ID
      const nonExistentTransactionId = generateUUID();

      // Act & Assert - Use sendRequest for error scenarios
      cy.sendRequest({
        url: API_ENDPOINTS.TRANSACTION_DETAIL(walletId, nonExistentTransactionId),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.commonTestData.testConfiguration.defaultHeaders
        },
        timeout: testData.testConfiguration.timeouts.apiResponse,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.greaterThan(testCase.expectedErrorStatus.minStatus - 1);
      });
    });
  });
});

