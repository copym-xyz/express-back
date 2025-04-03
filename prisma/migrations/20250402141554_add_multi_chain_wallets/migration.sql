-- AlterTable
ALTER TABLE `issuer` ADD COLUMN `ethereum_address` VARCHAR(191) NULL,
    ADD COLUMN `ethereum_wallet_created_at` DATETIME(3) NULL,
    ADD COLUMN `solana_address` VARCHAR(191) NULL,
    ADD COLUMN `solana_wallet_created_at` DATETIME(3) NULL;
