const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { createWallet: createCrossmintWallet, getWalletBalance, SUPPORTED_CHAINS } = require('../../utils/crossmintUtils');
const { generateCredentialSvg } = require('../../utils/svgGenerator');

const prisma = new PrismaClient();

// API configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";

/**
 * Wallet Service - Contains business logic for wallet-related operations
 */
class WalletService {
  /**
   * Helper function for making Crossmint API calls
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {object} data - Request body
   * @param {object} params - Query parameters
   * @returns {Promise<object>} API response
   * @private
   */
  async _crossmintRequest(endpoint, method = 'GET', data = null, params = null) {
    const url = new URL(`${CROSSMINT_BASE_URL}${endpoint}`);
    if (params) url.search = new URLSearchParams(params).toString();
    
    return axios({
      method,
      url: url.toString(),
      headers: { "X-API-KEY": CROSSMINT_API_KEY, "Content-Type": "application/json" },
      ...(data ? { data } : {})
    });
  }

  /**
   * Get supported blockchain chains
   * @returns {string[]} List of supported chains
   */
  getSupportedChains() {
    return Object.keys(SUPPORTED_CHAINS);
  }

  /**
   * Get or create user's wallet
   * @param {number} userId - User ID
   * @param {boolean} isIssuer - Whether the user is an issuer
   * @param {string} chain - Blockchain chain
   * @returns {Promise<object>} Wallet data
   */
  async getUserWallet(userId, isIssuer, chain) {
    // Check if wallet exists or create new one
    let wallet = await prisma.wallet.findFirst({ where: { user_id: userId } });
    if (!wallet) {
      const result = await createCrossmintWallet(userId, isIssuer, chain);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create wallet');
      }
      wallet = result.data.wallet;
    }

    return wallet;
  }

  /**
   * Create a new wallet
   * @param {number} userId - User ID
   * @param {boolean} isIssuer - Whether the user is an issuer
   * @param {string} chain - Blockchain chain
   * @returns {Promise<object>} Created wallet data
   */
  async createWallet(userId, isIssuer, chain) {
    const result = await createCrossmintWallet(userId, isIssuer, chain);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create wallet');
    }
    
    return {
      wallet: result.data.wallet,
      chain: result.data.chain,
      did: result.data.did
    };
  }

  /**
   * Get wallet balance
   * @param {number} userId - User ID
   * @returns {Promise<object>} Balance data
   */
  async getWalletBalance(userId) {
    // Get user's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });

    if (!wallet) {
      throw new Error('No wallet found for this user');
    }

    // Get balance from Crossmint
    const tokens = ["eth", "usdc"];
    const chains = ["polygon-mumbai", "base-sepolia"];

    const response = await this._crossmintRequest(`/v1-alpha2/wallets/${wallet.address}/balances`, 'GET', null, {
      tokens: tokens.join(','),
      chains: chains.join(',')
    });

    return response.data;
  }

  /**
   * Get NFTs owned by the wallet
   * @param {number} userId - User ID
   * @returns {Promise<object>} NFT data
   */
  async getWalletNFTs(userId) {
    // Get user's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });
    if (!wallet) throw new Error('No wallet found for this user');

    // Get issuer profile - don't throw error if not found
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });

    // Initialize return structure
    let dbNfts = [];
    let crossmintNfts = [];

    // Get credentials from database if issuer exists
    if (issuer) {
      try {
        const credentials = await prisma.issuer_credentials.findMany({
          where: { issuer_id: issuer.id },
          select: {
            id: true, credential_id: true, credential_type: true, status: true,
            issued_date: true, expiry_date: true, metadata: true
          },
          orderBy: { created_at: 'desc' }
        });

        // Format response
        dbNfts = credentials.map(cred => {
          let metadata = {};
          try {
            if (cred.metadata) metadata = JSON.parse(cred.metadata);
          } catch (error) {
            console.warn(`Failed to parse metadata for credential ${cred.id}:`, error.message);
          }

          return {
            id: cred.id,
            credentialId: cred.credential_id,
            type: cred.credential_type,
            status: cred.status,
            issuedDate: cred.issued_date,
            expiryDate: cred.expiry_date,
            chain: metadata?.onChain?.chain,
            contractAddress: metadata?.onChain?.contractAddress,
            tokenId: metadata?.onChain?.tokenId,
            transactionHash: metadata?.onChain?.transactionHash,
            metadata
          };
        });
      } catch (dbError) {
        console.error('Error fetching database NFTs:', dbError);
      }
    }

    // Fetch NFTs from Crossmint API
    try {
      const collectionsResponse = await this._crossmintRequest('/2022-06-09/collections');
      
      if (collectionsResponse.data?.collections?.length) {
        // Get issuer data for SVG generation
        const issuerName = issuer ? issuer.company_name : "Verified User";
        
        // Process each collection
        for (const collection of collectionsResponse.data.collections) {
          try {
            const nftResponse = await this._crossmintRequest(
              `/2022-06-09/collections/${collection.id}/nfts`, 
              'GET'
            );
            
            if (nftResponse.data?.nfts?.length) {
              for (const nft of nftResponse.data.nfts) {
                try {
                  // Generate SVG
                  const svgData = await generateCredentialSvg({
                    title: nft.metadata?.name || "Verification Credential",
                    issuer: issuerName,
                    issuanceDate: nft.metadata?.attributes?.find(a => a.trait_type === "Issuance Date")?.value 
                      || nft.metadata?.attributes?.find(a => a.trait_type === "Issued Date")?.value
                      || new Date().toISOString().split('T')[0],
                    credentialType: nft.metadata?.attributes?.find(a => a.trait_type === "Credential Type")?.value || "Credential"
                  });
                  
                  // Add to NFTs array
                  crossmintNfts.push({
                    id: nft.id,
                    credentialId: nft.id,
                    type: nft.metadata?.attributes?.find(a => a.trait_type === "Credential Type")?.value || "Unknown",
                    status: "ACTIVE",
                    issuedDate: nft.metadata?.attributes?.find(a => a.trait_type === "Issued Date")?.value
                      || nft.metadata?.attributes?.find(a => a.trait_type === "Issuance Date")?.value,
                    chain: nft.chain,
                    contractAddress: nft.contractAddress,
                    tokenId: nft.tokenId,
                    metadata: nft.metadata,
                    image: svgData || nft.metadata?.image,
                    name: nft.metadata?.name,
                    description: nft.metadata?.description
                  });
                } catch (svgError) {
                  console.error('Error generating SVG for NFT:', svgError);
                  // Still add the NFT even if SVG generation fails
                  crossmintNfts.push({
                    id: nft.id,
                    credentialId: nft.id,
                    type: "Credential",
                    status: "ACTIVE",
                    chain: nft.chain,
                    contractAddress: nft.contractAddress,
                    tokenId: nft.tokenId,
                    metadata: nft.metadata,
                    image: nft.metadata?.image,
                    name: nft.metadata?.name,
                    description: nft.metadata?.description
                  });
                }
              }
            }
          } catch (nftError) {
            console.error(`Error fetching NFTs for collection ${collection.id}:`, nftError);
          }
        }
      }
    } catch (apiError) {
      console.error('Error fetching Crossmint NFTs:', apiError);
    }

    // Return structured response
    return {
      dbNfts,
      crossmintNfts,
      total: dbNfts.length + crossmintNfts.length
    };
  }

  /**
   * Get wallet transactions
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Transaction data
   */
  async getWalletTransactions(userId) {
    const wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });
    
    if (!wallet) {
      throw new Error('No wallet found for this user');
    }
    
    const response = await this._crossmintRequest(`/v1-alpha2/wallets/${wallet.address}/transactions`);
    return response.data;
  }
}

module.exports = new WalletService(); 