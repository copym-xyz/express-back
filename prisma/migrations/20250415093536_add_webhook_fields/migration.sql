/*
  Warnings:

  - You are about to drop the `sumsubapplicant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sumsubdocument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sumsubreview` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sumsubwebhook` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verificationattempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhookconfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `sumsubapplicant` DROP FOREIGN KEY `SumsubApplicant_userId_fkey`;

-- DropForeignKey
ALTER TABLE `sumsubdocument` DROP FOREIGN KEY `SumsubDocument_applicantId_fkey`;

-- DropForeignKey
ALTER TABLE `sumsubreview` DROP FOREIGN KEY `SumsubReview_applicantId_fkey`;

-- DropForeignKey
ALTER TABLE `sumsubwebhook` DROP FOREIGN KEY `SumsubWebhook_applicantId_fkey`;

-- DropForeignKey
ALTER TABLE `sumsubwebhook` DROP FOREIGN KEY `SumsubWebhook_userId_fkey`;

-- DropForeignKey
ALTER TABLE `verificationattempt` DROP FOREIGN KEY `VerificationAttempt_applicantId_fkey`;

-- DropForeignKey
ALTER TABLE `verificationattempt` DROP FOREIGN KEY `VerificationAttempt_userId_fkey`;

-- DropTable
DROP TABLE `sumsubapplicant`;

-- DropTable
DROP TABLE `sumsubdocument`;

-- DropTable
DROP TABLE `sumsubreview`;

-- DropTable
DROP TABLE `sumsubwebhook`;

-- DropTable
DROP TABLE `verificationattempt`;

-- DropTable
DROP TABLE `webhookconfig`;

-- CreateTable
CREATE TABLE `kyc_verifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` VARCHAR(191) NOT NULL,
    `externalUserId` VARCHAR(191) NOT NULL,
    `inspectionId` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `reviewStatus` VARCHAR(191) NOT NULL,
    `reviewResult` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifiedAt` DATETIME(3) NOT NULL,
    `rawData` TEXT NOT NULL,
    `userId` INTEGER NULL,
    `signatureValid` BOOLEAN NOT NULL DEFAULT false,
    `webhookType` VARCHAR(191) NULL,
    `eventTimestamp` DATETIME(3) NULL,
    `processingStatus` VARCHAR(191) NULL DEFAULT 'processed',
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` VARCHAR(191) NULL,

    INDEX `kyc_verifications_externalUserId_idx`(`externalUserId`),
    INDEX `kyc_verifications_webhookType_idx`(`webhookType`),
    INDEX `kyc_verifications_applicantId_idx`(`applicantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kyc_verifications` ADD CONSTRAINT `kyc_verifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
