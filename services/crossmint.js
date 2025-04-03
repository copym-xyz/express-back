const fetch = require('node-fetch');

class CrossmintService {
  constructor() {
    this.apiKey = "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
    this.baseUrl = "https://staging.crossmint.com/api/2022-06-09";
  }

  async createIssuerWallet(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/wallets`, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "solana-smart-wallet",
          config: {
            adminSigner: {
              type: "solana-fireblocks-custodial"
            }
          },
          linkedUser: `userId:${userId}`
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create wallet: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating Crossmint wallet:', error);
      throw error;
    }
  }

  async getWalletBalance(walletAddress, tokens = ["sol", "usdc"], chains = ["solana-devnet"]) {
    try {
      const url = new URL(`${this.baseUrl}/wallets/${walletAddress}/balances`);
      url.search = new URLSearchParams({
        tokens: tokens.join(','),
        chains: chains.join(',')
      }).toString();

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get wallet balance: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      throw error;
    }
  }
}

module.exports = new CrossmintService(); 