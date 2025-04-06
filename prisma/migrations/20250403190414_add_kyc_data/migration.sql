-- CreateTable
CREATE TABLE `KycData` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `onfido_applicant_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `document_type` VARCHAR(191) NULL,
    `document_id` VARCHAR(191) NULL,
    `selfie_id` VARCHAR(191) NULL,
    `check_id` VARCHAR(191) NULL,
    `check_status` VARCHAR(191) NULL,
    `check_result` VARCHAR(191) NULL,
    `rejection_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_check_date` DATETIME(3) NULL,
    `manual_review_date` DATETIME(3) NULL,
    `manual_reviewer_id` INTEGER NULL,
    `attempts_count` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `KycData_user_id_key`(`user_id`),
    UNIQUE INDEX `KycData_onfido_applicant_id_key`(`onfido_applicant_id`),
    INDEX `KycData_status_idx`(`status`),
    INDEX `KycData_check_status_idx`(`check_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KycData` ADD CONSTRAINT `KycData_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
