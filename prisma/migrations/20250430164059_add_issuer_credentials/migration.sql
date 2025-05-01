-- CreateTable
CREATE TABLE `kyc_verifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `applicant_id` VARCHAR(191) NOT NULL,
    `correlation_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `error_message` TEXT NULL,
    `event_timestamp` DATETIME(3) NOT NULL,
    `external_user_id` VARCHAR(191) NULL,
    `inspection_id` VARCHAR(191) NULL,
    `processing_status` VARCHAR(191) NULL,
    `raw_data` TEXT NOT NULL,
    `review_result` VARCHAR(191) NULL,
    `review_status` VARCHAR(191) NOT NULL,
    `signature_valid` BOOLEAN NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` INTEGER NULL,
    `webhook_type` VARCHAR(191) NOT NULL,

    INDEX `kyc_verifications_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `document_id` VARCHAR(191) NULL,
    `document_sub_type` VARCHAR(191) NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `field_name` VARCHAR(191) NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NULL,
    `id_doc_type` VARCHAR(191) NULL,
    `issued_date` DATETIME(3) NULL,
    `number` VARCHAR(191) NULL,
    `page_type` VARCHAR(191) NULL,
    `record_id` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` INTEGER NULL,
    `valid_until` DATETIME(3) NULL,

    INDEX `kyc_documents_document_type_idx`(`document_type`),
    INDEX `kyc_documents_record_id_idx`(`record_id`),
    INDEX `kyc_documents_status_idx`(`status`),
    INDEX `kyc_documents_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `last_login` DATETIME(3) NULL,

    UNIQUE INDEX `Admin_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authprovider` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `provider_name` VARCHAR(191) NOT NULL,
    `provider_user_id` VARCHAR(191) NOT NULL,
    `provider_data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used` DATETIME(3) NOT NULL,

    INDEX `AuthProvider_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `didwallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `wallet_address` VARCHAR(191) NOT NULL,
    `did` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used` DATETIME(3) NOT NULL,

    INDEX `DIDWallet_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `investor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `investor_type` VARCHAR(191) NOT NULL,
    `accreditation_status` VARCHAR(191) NOT NULL,
    `accreditation_date` DATETIME(3) NULL,
    `kyc_documents` JSON NULL,
    `aml_documents` JSON NULL,
    `kyc_verified` BOOLEAN NOT NULL DEFAULT false,
    `aml_verified` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Investor_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issuer` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `company_registration_number` VARCHAR(191) NOT NULL,
    `jurisdiction` VARCHAR(191) NOT NULL,
    `verification_status` BOOLEAN NOT NULL DEFAULT false,
    `verification_date` DATETIME(3) NULL,
    `company_documents` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_kyb_completed` BOOLEAN NOT NULL DEFAULT false,
    `mobile_number` VARCHAR(191) NULL,
    `platform_client_id` VARCHAR(191) NULL,
    `registration_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sumsub_applicant_id` VARCHAR(191) NULL,
    `sumsub_correlation_id` VARCHAR(191) NULL,
    `sumsub_external_id` VARCHAR(191) NULL,
    `sumsub_inspection_id` VARCHAR(191) NULL,
    `did` VARCHAR(191) NULL,
    `did_created_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `issuer_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_address_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NOT NULL,
    `address_type` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `street` VARCHAR(191) NULL,
    `street_line2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `postal_code` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verification_method` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kyc_address_info_applicant_id_fkey`(`applicant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `record_id` INTEGER NOT NULL,
    `address_type` VARCHAR(191) NOT NULL DEFAULT 'RESIDENTIAL',
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `street` VARCHAR(191) NULL,
    `street_line_2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `postal_code` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_addresses_record_id_idx`(`record_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_applicants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `external_user_id` VARCHAR(191) NULL,
    `inspection_id` VARCHAR(191) NULL,
    `correlation_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `result` VARCHAR(191) NULL,
    `id_doc_status` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `sandbox_mode` BOOLEAN NOT NULL DEFAULT false,
    `personal_info_id` INTEGER NULL,

    UNIQUE INDEX `kyc_applicants_applicant_id_key`(`applicant_id`),
    UNIQUE INDEX `kyc_applicants_personal_info_id_key`(`personal_info_id`),
    INDEX `kyc_applicants_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `performed_by` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_audit_log_applicant_id_fkey`(`applicant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_complete_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `result` VARCHAR(191) NULL,
    `complete_data` JSON NULL,
    `collected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `kyc_complete_records_applicant_id_key`(`applicant_id`),
    INDEX `kyc_complete_records_result_idx`(`result`),
    INDEX `kyc_complete_records_status_idx`(`status`),
    INDEX `kyc_complete_records_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_personal_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NULL,
    `record_id` INTEGER NULL,
    `first_name` VARCHAR(191) NULL,
    `last_name` VARCHAR(191) NULL,
    `middle_name` VARCHAR(191) NULL,
    `full_name` VARCHAR(191) NULL,
    `legal_name` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `date_of_birth` DATETIME(3) NULL,
    `place_of_birth` VARCHAR(191) NULL,
    `country_of_birth` VARCHAR(191) NULL,
    `state_of_birth` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `tax_residence_country` VARCHAR(191) NULL,
    `tax_identification_number` VARCHAR(191) NULL,
    `id_number` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kyc_personal_info_record_id_key`(`record_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_raw_data` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NOT NULL,
    `data_type` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `raw_data` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_raw_data_applicant_id_fkey`(`applicant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_verification_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `record_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'webhook',
    `review_status` VARCHAR(191) NULL,
    `review_result` VARCHAR(191) NULL,
    `inspection_id` VARCHAR(191) NULL,
    `event_data` JSON NULL,
    `event_timestamp` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_verification_events_record_id_idx`(`record_id`),
    INDEX `kyc_verification_events_review_result_idx`(`review_result`),
    INDEX `kyc_verification_events_review_status_idx`(`review_status`),
    INDEX `kyc_verification_events_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_verification_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `review_status` VARCHAR(191) NOT NULL,
    `review_result` VARCHAR(191) NULL,
    `review_answer` VARCHAR(191) NULL,
    `reject_type` VARCHAR(191) NULL,
    `reject_labels` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_verification_history_applicant_id_fkey`(`applicant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refreshtoken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `device_info` VARCHAR(191) NULL,

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    INDEX `RefreshToken_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `userrole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserRole_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `applicant_id` VARCHAR(191) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verification_result` VARCHAR(191) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `issuer_id` VARCHAR(191) NULL,
    `address` VARCHAR(191) NOT NULL,
    `chain` VARCHAR(191) NOT NULL DEFAULT 'polygon',
    `type` VARCHAR(191) NOT NULL DEFAULT 'evm-mpc-wallet',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'crossmint',
    `did` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `credentials` JSON NULL,

    UNIQUE INDEX `wallet_user_id_key`(`user_id`),
    UNIQUE INDEX `wallet_issuer_id_key`(`issuer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `signature` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'sumsub',
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issuer_credentials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuer_id` VARCHAR(191) NOT NULL,
    `credential_id` VARCHAR(191) NOT NULL,
    `credential_type` VARCHAR(191) NOT NULL,
    `issued_date` DATETIME(3) NOT NULL,
    `expiry_date` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `metadata` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `issuer_credentials_issuer_id_idx`(`issuer_id`),
    INDEX `issuer_credentials_credential_id_idx`(`credential_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kyc_verifications` ADD CONSTRAINT `kyc_verifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_documents` ADD CONSTRAINT `kyc_documents_record_id_fkey` FOREIGN KEY (`record_id`) REFERENCES `kyc_complete_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_documents` ADD CONSTRAINT `kyc_documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin` ADD CONSTRAINT `Admin_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `authprovider` ADD CONSTRAINT `AuthProvider_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `didwallet` ADD CONSTRAINT `DIDWallet_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `investor` ADD CONSTRAINT `Investor_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issuer` ADD CONSTRAINT `issuer_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_address_info` ADD CONSTRAINT `kyc_address_info_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `kyc_applicants`(`applicant_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_addresses` ADD CONSTRAINT `kyc_addresses_record_id_fkey` FOREIGN KEY (`record_id`) REFERENCES `kyc_complete_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_applicants` ADD CONSTRAINT `kyc_applicants_personal_info_id_fkey` FOREIGN KEY (`personal_info_id`) REFERENCES `kyc_personal_info`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_applicants` ADD CONSTRAINT `kyc_applicants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_audit_log` ADD CONSTRAINT `kyc_audit_log_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `kyc_applicants`(`applicant_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_complete_records` ADD CONSTRAINT `kyc_complete_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_personal_info` ADD CONSTRAINT `kyc_personal_info_record_id_fkey` FOREIGN KEY (`record_id`) REFERENCES `kyc_complete_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_raw_data` ADD CONSTRAINT `kyc_raw_data_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `kyc_applicants`(`applicant_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_verification_events` ADD CONSTRAINT `kyc_verification_events_record_id_fkey` FOREIGN KEY (`record_id`) REFERENCES `kyc_complete_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_verification_history` ADD CONSTRAINT `kyc_verification_history_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `kyc_applicants`(`applicant_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refreshtoken` ADD CONSTRAINT `RefreshToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `userrole` ADD CONSTRAINT `UserRole_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet` ADD CONSTRAINT `wallet_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `issuer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet` ADD CONSTRAINT `wallet_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issuer_credentials` ADD CONSTRAINT `issuer_credentials_issuer_id_fkey` FOREIGN KEY (`issuer_id`) REFERENCES `issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
