-- CreateTable
CREATE TABLE `KybApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` INTEGER NOT NULL,
    `status` ENUM('PENDING_DOCUMENTS', 'VERIFIED', 'REJECTED', 'PARTIALLY_VERIFIED', 'DOCUMENT_MISSING') NOT NULL DEFAULT 'PENDING_DOCUMENTS',
    `application_number` VARCHAR(191) NOT NULL,
    `business_type` VARCHAR(191) NOT NULL,
    `business_address` VARCHAR(191) NOT NULL,
    `country_of_incorporation` VARCHAR(191) NOT NULL,
    `tax_identification_number` VARCHAR(191) NULL,
    `submission_date` DATETIME(3) NULL,
    `approval_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KybApplication_application_number_key`(`application_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KybDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER NOT NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `document_number` VARCHAR(191) NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `verification_status` ENUM('PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_ADDITIONAL_INFO') NOT NULL DEFAULT 'PENDING',
    `rejection_reason` VARCHAR(191) NULL,
    `upload_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verified_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KybApplication` ADD CONSTRAINT `KybApplication_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KybDocument` ADD CONSTRAINT `KybDocument_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `KybApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
