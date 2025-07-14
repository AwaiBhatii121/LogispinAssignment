import { API_ENDPOINTS } from '../support/constants';
import { ValidationHelpers, DataGenerators } from '../support/test-helpers';
describe('Wallet API Transaction Processing', () => {
  let walletId;
  let authToken;
  let userId;
  let testData;
  before(() => {
    cy.fixture('wallet').then((data) => {
      testData = data;
      return cy.sendRequest({
        url: API_ENDPOINTS.AUTH.LOGIN(),
        method: 'POST',
        headers: testData.testConfiguration.defaultHeaders,
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
      return cy.sendRequest({
        url: API_ENDPOINTS.USER.PROFILE(userId),
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
    Cypress.env('authToken', authToken);
    Cypress.env('userId', userId);
    Cypress.env('walletId', walletId);
  });
  describe('TC01: Process Successful Credit Transaction', () => {
    it('should successfully process a credit transaction', () => {
      const testCase = testData.testCases.TC01_successfulCreditTransaction;
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        body: testCase.transactionData,
        failOnStatusCode: true
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201]);
        const result = response.body;
        expect(ValidationHelpers.validateTransactionStructure(result, testCase.expectedResponse.properties)).to.be.true;
        expect(ValidationHelpers.isValidUUID(result.transactionId)).to.be.true;
        expect(result.status).to.match(new RegExp(testCase.expectedResponse.statusPattern));
        expect(ValidationHelpers.isValidISODate(result.createdAt)).to.be.true;
      });
    });
  });
  describe('TC02: Process Debit Transaction with Sufficient Balance', () => {
    it('should successfully process a debit transaction when balance is sufficient', () => {
      const testCase = testData.testCases.TC02_debitTransactionSufficientBalance;
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        body: testCase.setupTransaction,
        failOnStatusCode: true
      }).then((creditResponse) => {
        expect(creditResponse.status).to.be.oneOf([200, 201]);
        const creditResult = creditResponse.body;
        const waitForCompletion = (transactionId) => {
          return cy.sendRequest({
            url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.testConfiguration.defaultHeaders
            },
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
        expect(completedCredit.outcome).to.equal(testCase.expectedOutcome);
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.testConfiguration.defaultHeaders
          },
          body: testCase.mainTransaction,
          failOnStatusCode: true
        }).then((debitResponse) => {
          expect(debitResponse.status).to.be.oneOf([200, 201]);
          const debitResult = debitResponse.body;
          const waitForDebitCompletion = (transactionId) => {
            return cy.sendRequest({
              url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                ...testData.testConfiguration.defaultHeaders
              },
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
  describe('TC03: Handle Pending Transaction Completion', () => {
    it('should handle pending transactions and eventual completion', () => {
      const testCase = testData.testCases.TC03_pendingTransactionCompletion;
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        body: testCase.transactionData,
        failOnStatusCode: true
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201]);
        const result = response.body;
        testCase.expectedResponse.properties.forEach(property => {
          if (property !== 'updatedAt') {
            expect(result).to.have.property(property);
          }
        });
        expect(ValidationHelpers.isValidUUID(result.transactionId)).to.be.true;
        const waitForTransactionCompletion = (transactionId) => {
          return cy.sendRequest({
            url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.testConfiguration.defaultHeaders
            },
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
        expect(ValidationHelpers.isValidISODate(completedTransaction.updatedAt)).to.be.true;
      });
    });
  }); 

describe('TC04: Multi-Currency Transaction Processing', () => {
    it('should process transactions in multiple currencies and create currency clips', () => {
      const testCase = testData.testCases.TC04_multiCurrencyTransactions;
      const transactionPromises = [];
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
            ...testData.testConfiguration.defaultHeaders
          },
          body: transactionData,
          failOnStatusCode: true
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 201]);
          return response.body;
        });
        transactionPromises.push(transactionPromise);
      });
      Promise.all(transactionPromises).then((results) => {
        expect(results).to.have.length(testCase.currencies.length);
        results.forEach((result) => {
          expect(result).to.have.property('transactionId');
          expect(result).to.have.property('status');
          expect(ValidationHelpers.isValidUUID(result.transactionId)).to.be.true;
        });
        const completionPromises = results.map(result => {
          if (result.status === 'pending') {
            const waitForCompletion = (transactionId) => {
              return cy.sendRequest({
                url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transactionId),
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  ...testData.testConfiguration.defaultHeaders
                },
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
          cy.sendRequest({
            url: API_ENDPOINTS.WALLET.GET_WALLET(walletId),
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.testConfiguration.defaultHeaders
            },
            failOnStatusCode: true
          }).then((walletResponse) => {
            expect(walletResponse.status).to.equal(200);
            const wallet = walletResponse.body;
            expect(wallet.currencyClips).to.have.length.greaterThan(testCase.expectedWalletProperties.currencyClips.minLength - 1);
            approvedTransactions.forEach(transaction => {
              cy.sendRequest({
                url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, transaction.transactionId),
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  ...testData.testConfiguration.defaultHeaders
                },
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
  describe('TC05: Transaction Input Validation', () => {
    it('should reject invalid transaction requests', () => {
      const testCase = testData.testCases.TC05_inputValidation;
      const invalidTransactions = Object.values(testCase.invalidTransactions);
      invalidTransactions.forEach((invalidTransaction) => {
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.testConfiguration.defaultHeaders
          },
          body: invalidTransaction,
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
      invalidAmountTransactions.forEach((invalidTransaction) => {
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.testConfiguration.defaultHeaders
          },
          body: invalidTransaction,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.greaterThan(testCase.expectedErrorStatus.minStatus - 1);
        });
      });
    });
  });
  describe('TC06: Wallet Balance Consistency', () => {
    it('should maintain consistent balance across multiple transactions', () => {
      const testCase = testData.testCases.TC06_balanceConsistency;
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.GET_WALLET(walletId),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        failOnStatusCode: true
      }).then((walletResponse) => {
        expect(walletResponse.status).to.equal(200);
        const initialWallet = walletResponse.body;
        const initialClip = initialWallet.currencyClips.find(clip => clip.currency === testCase.currency);
        const initialBalance = initialClip ? initialClip.balance : 0;
        const processTransactionsSequentially = (transactionList, results = []) => {
          if (transactionList.length === 0) {
            return Promise.resolve(results);
          }
          const [currentTransaction, ...remainingTransactions] = transactionList;
          return cy.sendRequest({
            url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...testData.testConfiguration.defaultHeaders
            },
            body: currentTransaction,
            failOnStatusCode: true
          }).then((response) => {
            expect(response.status).to.be.oneOf([200, 201]);
            results.push(response.body);
            return processTransactionsSequentially(remainingTransactions, results);
          });
        };
        return processTransactionsSequentially(testCase.transactions).then((results) => {
          const completionPromises = results.map(result => {
            if (result.status === 'pending') {
              const waitForCompletion = (transactionId) => {
                return cy.sendRequest({
                  url: API_ENDPOINTS.GET_TRANSACTION(walletId, transactionId),
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${authToken}`,
                    ...testData.testConfiguration.defaultHeaders
                  },
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
            const expectedBalance = calculateExpectedBalance(initialBalance, completedTransactions);
            cy.sendRequest({
              url: API_ENDPOINTS.WALLET.GET_WALLET(walletId),
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                ...testData.testConfiguration.defaultHeaders
              },
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
describe('TC07: Transaction History Retrieval', () => {
    it('should retrieve transaction history with proper pagination', () => {
      const testCase = testData.testCases.TC07_transactionHistory;
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.PROCESS_TRANSACTION(walletId),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        body: testCase.testTransaction,
        failOnStatusCode: true
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201]);
        cy.sendRequest({
          url: API_ENDPOINTS.WALLET.GET_ALL_TRANSACTIONS(walletId),
          method: 'GET',
          queryParameters: testCase.paginationTest,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...testData.testConfiguration.defaultHeaders
          },
          failOnStatusCode: true
        }).then((transactionsResponse) => {
          expect(transactionsResponse.status).to.equal(200);
          const transactions = transactionsResponse.body;
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
      const dateFilter = TestHelpers.dates.getTodayDateRange();
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.GET_ALL_TRANSACTIONS(walletId),
        method: 'GET',
        queryParameters: dateFilter,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        failOnStatusCode: true
      }).then((transactionsResponse) => {
        expect(transactionsResponse.status).to.equal(200);
        expect(transactionsResponse.body).to.have.property('transactions');
        expect(transactionsResponse.body.transactions).to.be.an('array');
      });
    });
  });
  describe('TC08: Error Handling for Non-existent Resources', () => {
    it('should handle requests for non-existent wallet gracefully', () => {
      const testCase = testData.testCases.TC08_errorHandling;
      const nonExistentWalletId = TestHelpers.dataGen.generateUUID();
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.GET_WALLET(nonExistentWalletId),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.at.least(testCase.expectedErrorStatus.minStatus);
      });
    });
    it('should handle requests for non-existent transaction gracefully', () => {
      const testCase = testData.testCases.TC08_errorHandling;
      const nonExistentTransactionId = TestHelpers.dataGen.generateUUID();
      cy.sendRequest({
        url: API_ENDPOINTS.WALLET.GET_TRANSACTION(walletId, nonExistentTransactionId),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          ...testData.testConfiguration.defaultHeaders
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.at.least(testCase.expectedErrorStatus.minStatus);
      });
    });
  });
});