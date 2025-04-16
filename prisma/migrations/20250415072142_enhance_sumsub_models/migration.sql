/*
  Warnings:

  - You are about to drop the column `is_kyc_verified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `kyc_status` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `kyc_verified_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `kyc_verifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `kyc_verifications` DROP FOREIGN KEY `kyc_verifications_userId_fkey`;

-- AlterTable
ALTER TABLE `issuer` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_kyb_completed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mobile_number` VARCHAR(191) NULL,
    ADD COLUMN `platform_client_id` VARCHAR(191) NULL,
    ADD COLUMN `registration_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `sumsub_applicant_id` VARCHAR(191) NULL,
    ADD COLUMN `sumsub_correlation_id` VARCHAR(191) NULL,
    ADD COLUMN `sumsub_external_id` VARCHAR(191) NULL,
    ADD COLUMN `sumsub_inspection_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `is_kyc_verified`,
    DROP COLUMN `kyc_status`,
    DROP COLUMN `kyc_verified_at`;

-- DropTable
DROP TABLE `kyc_verifications`;

-- CreateTable
CREATE TABLE `SumsubApplicant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` VARCHAR(191) NOT NULL,
    `externalUserId` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `levelName` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'individual',
    `inspectionId` VARCHAR(191) NULL,
    `reviewStatus` VARCHAR(191) NOT NULL,
    `reviewResult` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `info` JSON NULL,
    `metadata` JSON NULL,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `requiredIdDocs` JSON NULL,

    UNIQUE INDEX `SumsubApplicant_applicantId_key`(`applicantId`),
    INDEX `SumsubApplicant_applicantId_idx`(`applicantId`),
    INDEX `SumsubApplicant_externalUserId_idx`(`externalUserId`),
    INDEX `SumsubApplicant_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SumsubDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` VARCHAR(191) NOT NULL,
    `idDocType` VARCHAR(191) NOT NULL,
    `subType` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `addedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fileId` VARCHAR(191) NULL,
    `filename` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `imageQuality` JSON NULL,
    `verificationResults` JSON NULL,

    INDEX `SumsubDocument_applicantId_idx`(`applicantId`),
    INDEX `SumsubDocument_idDocType_idx`(`idDocType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SumsubReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `reviewStatus` VARCHAR(191) NOT NULL,
    `reviewResult` VARCHAR(191) NULL,
    `rejectType` VARCHAR(191) NULL,
    `rejectLabels` JSON NULL,
    `moderatorComment` VARCHAR(191) NULL,
    `clientComment` VARCHAR(191) NULL,
    `reviewDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NULL,

    UNIQUE INDEX `SumsubReview_applicantId_key`(`applicantId`),
    INDEX `SumsubReview_applicantId_idx`(`applicantId`),
    INDEX `SumsubReview_reviewStatus_idx`(`reviewStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SumsubWebhook` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` VARCHAR(191) NOT NULL,
    `inspectionId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `reviewResult` VARCHAR(191) NULL,
    `rejectType` VARCHAR(191) NULL,
    `rejectLabels` JSON NULL,
    `reviewAnswer` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifiedAt` DATETIME(3) NOT NULL,
    `rawPayload` JSON NOT NULL,
    `verificationId` VARCHAR(191) NULL,
    `externalUserId` VARCHAR(191) NULL,
    `levelName` VARCHAR(191) NULL,
    `sandboxMode` BOOLEAN NOT NULL DEFAULT false,
    `clientId` VARCHAR(191) NULL,
    `correlationId` VARCHAR(191) NULL,
    `reviewStatus` VARCHAR(191) NULL,
    `applicantType` VARCHAR(191) NULL,
    `userId` INTEGER NULL,

    INDEX `SumsubWebhook_applicantId_idx`(`applicantId`),
    INDEX `SumsubWebhook_externalUserId_idx`(`externalUserId`),
    INDEX `SumsubWebhook_type_idx`(`type`),
    INDEX `SumsubWebhook_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `applicantId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `result` VARCHAR(191) NULL,
    `failureReason` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NULL,
    `levelName` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,

    INDEX `VerificationAttempt_userId_idx`(`userId`),
    INDEX `VerificationAttempt_applicantId_idx`(`applicantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `targetUrl` VARCHAR(191) NOT NULL,
    `secretKey` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifiedAt` DATETIME(3) NOT NULL,
    `lastPingAt` DATETIME(3) NULL,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `digestAlg` VARCHAR(191) NOT NULL DEFAULT 'HMAC_SHA256_HEX',

    UNIQUE INDEX `WebhookConfig_name_key`(`name`),
    INDEX `WebhookConfig_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SumsubApplicant` ADD CONSTRAINT `SumsubApplicant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SumsubDocument` ADD CONSTRAINT `SumsubDocument_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `SumsubApplicant`(`applicantId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SumsubReview` ADD CONSTRAINT `SumsubReview_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `SumsubApplicant`(`applicantId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SumsubWebhook` ADD CONSTRAINT `SumsubWebhook_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SumsubWebhook` ADD CONSTRAINT `SumsubWebhook_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `SumsubApplicant`(`applicantId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `SumsubApplicant`(`applicantId`) ON DELETE RESTRICT ON UPDATE CASCADE;
