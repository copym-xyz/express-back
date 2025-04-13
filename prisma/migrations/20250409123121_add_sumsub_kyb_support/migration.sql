/*
  Warnings:

  - You are about to alter the column `status` on the `kybapplication` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `VarChar(191)`.
  - You are about to alter the column `verification_status` on the `kybdocument` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `issuer` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_kyb_completed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mobile_number` VARCHAR(191) NULL,
    ADD COLUMN `platform_client_id` VARCHAR(191) NULL,
    ADD COLUMN `registration_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `sumsub_correlation_id` VARCHAR(191) NULL,
    ADD COLUMN `sumsub_inspection_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `kybapplication` MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    MODIFY `business_type` VARCHAR(191) NULL,
    MODIFY `business_address` VARCHAR(191) NULL,
    MODIFY `country_of_incorporation` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `kybdocument` MODIFY `verification_status` VARCHAR(191) NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE `IssuerWallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` INTEGER NOT NULL,
    `wallet_address` VARCHAR(191) NOT NULL,
    `wallet_type` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(18, 8) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `IssuerWallet_issuer_id_key`(`issuer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DecentralizedIdentifier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` INTEGER NOT NULL,
    `did_value` VARCHAR(191) NOT NULL,
    `did_method` VARCHAR(191) NOT NULL,
    `controller_key` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `DecentralizedIdentifier_did_value_key`(`did_value`),
    INDEX `did_issuer_id_idx`(`issuer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SoulboundToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` INTEGER NOT NULL,
    `token_address` VARCHAR(191) NOT NULL,
    `token_uri` VARCHAR(191) NOT NULL,
    `token_type` VARCHAR(191) NOT NULL,
    `metadata_hash` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `minted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SoulboundToken_token_address_key`(`token_address`),
    INDEX `sbt_issuer_id_idx`(`issuer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerifiableCredential` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` INTEGER NOT NULL,
    `credential_type` VARCHAR(191) NOT NULL,
    `credential_hash` VARCHAR(191) NOT NULL,
    `issuer_did` VARCHAR(191) NOT NULL,
    `subject_did` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `proof_type` VARCHAR(191) NOT NULL,
    `proof_value` VARCHAR(191) NOT NULL,
    `issuance_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiration_date` DATETIME(3) NULL,
    `revocation_date` DATETIME(3) NULL,

    INDEX `vc_issuer_id_idx`(`issuer_id`),
    INDEX `vc_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `activity_type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(191) NULL,

    INDEX `admin_id_idx`(`admin_id`),
    INDEX `admin_activity_type_idx`(`activity_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssuerActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` INTEGER NOT NULL,
    `activity_type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(191) NULL,

    INDEX `issuer_id_idx`(`issuer_id`),
    INDEX `issuer_activity_type_idx`(`activity_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `status_idx` ON `KybApplication`(`status`);

-- CreateIndex
CREATE INDEX `verification_status_idx` ON `KybDocument`(`verification_status`);

-- AddForeignKey
ALTER TABLE `IssuerWallet` ADD CONSTRAINT `IssuerWallet_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecentralizedIdentifier` ADD CONSTRAINT `DecentralizedIdentifier_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SoulboundToken` ADD CONSTRAINT `SoulboundToken_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerifiableCredential` ADD CONSTRAINT `VerifiableCredential_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminActivityLog` ADD CONSTRAINT `AdminActivityLog_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `Admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuerActivityLog` ADD CONSTRAINT `IssuerActivityLog_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `kybapplication` RENAME INDEX `KybApplication_issuer_id_fkey` TO `issuer_id_idx`;

-- RenameIndex
ALTER TABLE `kybdocument` RENAME INDEX `KybDocument_application_id_fkey` TO `application_id_idx`;
