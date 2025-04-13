/*
  Warnings:

  - You are about to drop the column `is_active` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `is_kyb_completed` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `mobile_number` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `platform_client_id` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `registration_date` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `sumsub_applicant_id` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `sumsub_correlation_id` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `sumsub_external_id` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the column `sumsub_inspection_id` on the `issuer` table. All the data in the column will be lost.
  - You are about to drop the `adminactivitylog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `decentralizedidentifier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `issueractivitylog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `issuerwallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kybapplication` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kybdocument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `soulboundtoken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verifiablecredential` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `adminactivitylog` DROP FOREIGN KEY `AdminActivityLog_admin_id_fkey`;

-- DropForeignKey
ALTER TABLE `decentralizedidentifier` DROP FOREIGN KEY `DecentralizedIdentifier_issuer_id_fkey`;

-- DropForeignKey
ALTER TABLE `issueractivitylog` DROP FOREIGN KEY `IssuerActivityLog_issuer_id_fkey`;

-- DropForeignKey
ALTER TABLE `issuerwallet` DROP FOREIGN KEY `IssuerWallet_issuer_id_fkey`;

-- DropForeignKey
ALTER TABLE `kybapplication` DROP FOREIGN KEY `KybApplication_issuer_id_fkey`;

-- DropForeignKey
ALTER TABLE `kybdocument` DROP FOREIGN KEY `KybDocument_application_id_fkey`;

-- DropForeignKey
ALTER TABLE `soulboundtoken` DROP FOREIGN KEY `SoulboundToken_issuer_id_fkey`;

-- DropForeignKey
ALTER TABLE `verifiablecredential` DROP FOREIGN KEY `VerifiableCredential_issuer_id_fkey`;

-- AlterTable
ALTER TABLE `issuer` DROP COLUMN `is_active`,
    DROP COLUMN `is_kyb_completed`,
    DROP COLUMN `mobile_number`,
    DROP COLUMN `platform_client_id`,
    DROP COLUMN `registration_date`,
    DROP COLUMN `sumsub_applicant_id`,
    DROP COLUMN `sumsub_correlation_id`,
    DROP COLUMN `sumsub_external_id`,
    DROP COLUMN `sumsub_inspection_id`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `sumsub_applicant_id` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `adminactivitylog`;

-- DropTable
DROP TABLE `decentralizedidentifier`;

-- DropTable
DROP TABLE `issueractivitylog`;

-- DropTable
DROP TABLE `issuerwallet`;

-- DropTable
DROP TABLE `kybapplication`;

-- DropTable
DROP TABLE `kybdocument`;

-- DropTable
DROP TABLE `soulboundtoken`;

-- DropTable
DROP TABLE `verifiablecredential`;

-- CreateTable
CREATE TABLE `KYC` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `applicant_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `document_type` VARCHAR(191) NULL,
    `document_id` VARCHAR(191) NULL,
    `check_id` VARCHAR(191) NULL,
    `check_result` VARCHAR(191) NULL,
    `rejection_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_check_date` DATETIME(3) NULL,
    `attempts_count` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `KYC_user_id_key`(`user_id`),
    UNIQUE INDEX `KYC_applicant_id_key`(`applicant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KYC` ADD CONSTRAINT `KYC_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
