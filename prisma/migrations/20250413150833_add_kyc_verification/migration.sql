-- AlterTable
ALTER TABLE `user` ADD COLUMN `is_kyc_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `kyc_status` VARCHAR(191) NULL DEFAULT 'pending',
    ADD COLUMN `kyc_verified_at` DATETIME(3) NULL;

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

    INDEX `kyc_verifications_externalUserId_idx`(`externalUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kyc_verifications` ADD CONSTRAINT `kyc_verifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
