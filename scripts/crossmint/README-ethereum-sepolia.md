# Issuing Credentials to Ethereum Sepolia Wallets with Crossmint

This guide explains how to issue verifiable credentials to Ethereum Sepolia wallets using the Crossmint API.

## Prerequisites

- Node.js and npm installed
- A Crossmint API key (included in the scripts)
- An Ethereum Sepolia wallet address to receive the credential

## Setup

1. Install the required dependencies:

```bash
npm install axios
```

## Workflow Overview

The process of issuing credentials to Ethereum Sepolia wallets involves the following steps:

1. Create a collection (only once)
2. Create a template in that collection (only once)
3. Issue credentials using the template
4. Check the status of issued credentials

## Step 1: Create a Collection

First, you need to create a collection on Ethereum Sepolia. This only needs to be done once.

```bash
node backend/scripts/crossmint/create-collection-ethereum-sepolia.js
```

This script will create a collection and output the collection ID, which will be used in the next steps.

## Step 2: Create a Template

Next, create a template within the collection:

```bash
node backend/scripts/crossmint/create-template-ethereum-sepolia.js
```

This script will create a template within the collection and output the template ID.

## Step 3: Issue a Credential

Now you can issue a credential to an Ethereum Sepolia wallet:

```bash
node backend/scripts/crossmint/issue-credential-ethereum-sepolia.js <WALLET_ADDRESS> [TEMPLATE_ID]
```

Where:
- `<WALLET_ADDRESS>` is the Ethereum Sepolia wallet address to receive the credential
- `[TEMPLATE_ID]` is optional; if not provided, the script will find the first available template

Example:
```bash
node backend/scripts/crossmint/issue-credential-ethereum-sepolia.js 0x8aE358505d41708dbF8280112d9431b82529A42B
```

This script will:
1. Find an appropriate template if not provided
2. Issue a credential to the specified wallet
3. Output the credential ID and action ID
4. Provide a command to check the credential status

## Step 4: Check Credential Status

After issuing a credential, you can check its status:

```bash
node backend/scripts/crossmint/check-credential-status.js <ACTION_ID>
```

Where `<ACTION_ID>` is the action ID returned from the issuing step.

Example:
```bash
node backend/scripts/crossmint/check-credential-status.js abc123def456
```

This will show the current status of the credential and its details.

## API Endpoints Used

The scripts use the following Crossmint API endpoints:

1. Create Collection:
   - `POST https://staging.crossmint.com/api/2022-06-09/collections`

2. Create Template:
   - `POST https://staging.crossmint.com/api/2022-06-09/collections/{collectionId}/templates`

3. Get Templates in Collection:
   - `GET https://staging.crossmint.com/api/2022-06-09/collections/{collectionId}/templates`

4. Issue Credential via Collection Template:
   - `POST https://staging.crossmint.com/api/2022-06-09/collections/{collectionId}/nfts`

5. Get Templates for Credential Type:
   - `GET https://staging.crossmint.com/api/v1-alpha1/credentials/types/{typeId}/templates`

6. Issue Credential via Credential Template:
   - `POST https://staging.crossmint.com/api/v1-alpha1/credentials/templates/{templateId}/vcs`

7. Check Action Status:
   - `GET https://staging.crossmint.com/api/v1-alpha1/credentials/actions/{actionId}`

8. Check Credential Status:
   - `GET https://staging.crossmint.com/api/v1-alpha1/credentials/{credentialId}`

## Troubleshooting

If you encounter issues:

1. Make sure you're using a valid Ethereum Sepolia wallet address
2. Check that the collection and template have been created successfully
3. Review error messages for specific API errors
4. The scripts include retry logic for failed API calls

## Notes on Credential Issuance

When issuing credentials to Ethereum Sepolia wallets:

1. The recipient format should be `ethereum-sepolia:<wallet_address>`
2. Credentials are issued as NFTs or verifiable credentials depending on the template type
3. The credential includes standard fields like issue date, expiration date, and verification status
4. Custom fields can be added through the credential subject data 