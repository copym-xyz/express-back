-- Add NFT-related fields to issuer_credentials table
ALTER TABLE `issuer_credentials` 
  ADD COLUMN `token_id` VARCHAR(191) NULL,
  ADD COLUMN `contract_address` VARCHAR(191) NULL,
  ADD COLUMN `chain` VARCHAR(191) NULL,
  ADD COLUMN `transaction_hash` VARCHAR(191) NULL,
  ADD COLUMN `image_url` VARCHAR(191) NULL;

-- Add indexes for NFT-related fields
CREATE INDEX `issuer_credentials_token_id_idx` ON `issuer_credentials`(`token_id`);
CREATE INDEX `issuer_credentials_contract_address_idx` ON `issuer_credentials`(`contract_address`); 