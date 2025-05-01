# Issuer Credential Flow Documentation

This document describes the process of issuer onboarding, wallet creation, and verifiable credential issuance.

## Overview

When a new issuer registers in the system, the following process occurs:

1. Issuer registration and account creation
2. KYC verification via SumSub
3. Automatic wallet creation using Crossmint API
4. Automatic issuance of a verifiable credential to the issuer's wallet

The process can be triggered automatically after KYC verification or manually via the "Issue Credential" button in the issuer dashboard.

## Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Issuer    │     │   SumSub    │     │  Crossmint  │     │ Blockchain  │
│ Onboarding  │────►│    KYC      │────►│Wallet & VC  │────►│  Ethereum   │
│             │     │ Verification│     │   Issuance  │     │   Sepolia   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Technical Implementation

### 1. Issuer Registration

- New issuer registers at `/api/auth/issuer/register`
- A user account is created with the `ISSUER` role
- An issuer profile is created with basic company information

### 2. KYC Verification

- Issuer completes KYC process via SumSub
- SumSub sends webhooks to our system at `/webhooks/sumsub`
- The system processes the `applicantReviewed` event
- If verification is successful, the issuer's `verification_status` is updated

### 3. Wallet Creation

- After successful KYC, a wallet is automatically created using:
  - Crossmint API: `https://staging.crossmint.com/api/2022-06-09/wallets`
  - Wallet type: `evm-mpc-wallet`
  - Chain: `ethereum-sepolia`
- The wallet address and DID are stored in the database
- The wallet is linked to the issuer's account

### 4. Credential Issuance

Credentials can be issued in two ways:

#### Automatic Issuance

After successful KYC verification, the system:
1. Ensures the issuer has a wallet
2. Automatically calls the Crossmint API to issue a credential
3. The credential is delivered to the issuer's wallet
4. A record is stored in the `issuer_credentials` table

#### Manual Issuance

The issuer can also request a credential manually:
1. Navigate to the issuer dashboard
2. Click the "Issue Credential" button
3. The system calls the `/api/issuer/issue-credential` endpoint
4. The credential is issued through the Crossmint API and delivered to the wallet

### 5. Credential Verification

- The credential issuance process is asynchronous
- The status can be checked using the action ID returned by Crossmint
- The script `backend/scripts/crossmint/check-credential-status.js` can be used to check status

## API Endpoints

Our implementation first tries to issue the credential as an NFT using the Collection ID, and if that fails, it falls back to the Verifiable Credentials API using the Template ID.

### Primary Method: NFT Minting Endpoint

```
POST https://staging.crossmint.com/api/2022-06-09/collections/<COLLECTION_ID>/nfts
Headers:
  X-API-KEY: <API_KEY>
  Content-Type: application/json
Body:
  {
    "metadata": {
      "name": "KYC Verification Credential",
      "description": "Proof of successful KYC verification",
      "image": "https://www.crossmint.com/assets/crossmint/logo.png",
      "attributes": [...]
    },
    "recipient": "ethereum-sepolia:<wallet_address>"
  }
```

### Fallback Method: Verifiable Credentials Endpoint

```
POST https://staging.crossmint.com/api/v1-alpha1/credentials/templates/<TEMPLATE_ID>/vcs
Headers:
  X-API-KEY: <API_KEY>
  Content-Type: application/json
Body:
  {
    "recipient": "ethereum-sepolia:<wallet_address>",
    "sendNotification": true,
    "locale": "en-US",
    "metadata": { ... },
    "credential": {
      "subject": { ... },
      "expiresAt": "<expiration_date>"
    }
  }
```

## Wallet Creation

```
POST https://staging.crossmint.com/api/2022-06-09/wallets
Headers:
  X-API-KEY: <API_KEY>
  Content-Type: application/json
Body:
  {
    "type": "evm-mpc-wallet",
    "linkedUser": "email:<user_email>",
    "webhookUrl": "<webhook_url>",
    "metadata": {
      "role": "issuer",
      "projectId": "<project_id>",
      "userId": "<user_id>"
    }
  }
```

## Configuration

Key configuration values:
- Collection ID: `9ead4bd2-b0bb-45c9-957c-a640752d0c68`
- Template ID: `1fb3506d-38cd-4fcb-95b9-b8aabef80797`
- Chain: `ethereum-sepolia`

These values can be configured via environment variables:
- `CROSSMINT_API_KEY`
- `COLLECTION_ID`
- `TEMPLATE_ID`

## Testing

To test credential issuance for a specific issuer:

```bash
node backend/scripts/crossmint/test-issue-credential.js <issuer_id>
```

## Debugging and Monitoring

### Checking Status

To check the status of a credential issuance:
```
node backend/scripts/crossmint/check-credential-status.js <action_id>
```

### Webhooks

The system receives and processes webhooks from Crossmint:
- Endpoint: `/webhooks/crossmint`
- Events: `wallets.transaction.succeeded`, `credential.creation.succeeded`
- Webhook logs are stored in the `webhook_logs` table

## Troubleshooting Common Issues

### 1. "Collection not found" Error

This occurs when the Collection ID provided doesn't exist in Crossmint:
- Verify the Collection ID in the Crossmint console
- Make sure the Collection ID is set correctly in the `COLLECTION_ID` environment variable
- Check that your API key has access to the collection

### 2. "Template not found" Error

This occurs when the Template ID provided doesn't exist in Crossmint:
- Verify the Template ID in the Crossmint console
- Make sure the Template ID is set correctly in the `TEMPLATE_ID` environment variable

### 3. Wallet Creation Failures

If wallet creation fails:
- Ensure the API key has the correct permissions
- Check that the chain (ethereum-sepolia) is supported
- Verify that the wallet type is valid (evm-mpc-wallet)

### 4. Credential Issuance Pending

If the credential remains in "pending" status:
- The blockchain transaction may still be processing
- Check the status again after a few minutes
- Verify in the Crossmint console that the transaction was initiated

### 5. API Key Issues

If you receive authorization errors:
- Verify the API key is correct and active
- Ensure the API key has the required scopes (wallet creation, NFT minting, credential issuance)
- Check if the API key has expired or been revoked

### 6. Recipient Format Issues

If there are issues with the recipient format:
- The format should be: `chain:walletAddress` (e.g., `ethereum-sepolia:0x1234...`)
- Ensure the wallet address is valid for the specified chain
- Verify the wallet exists in Crossmint's system 