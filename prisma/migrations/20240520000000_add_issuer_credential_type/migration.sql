-- CreateTable
CREATE TABLE `issuer_credential_type` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `applicant_id` VARCHAR(191) NOT NULL,
  `user_id` INTEGER NOT NULL,
  `first_name` VARCHAR(191) NULL,
  `last_name` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `date_of_birth` DATETIME(3) NULL,
  `verification_date` DATETIME(3) NULL,
  `verification_status` VARCHAR(191) NULL,
  `review_result` VARCHAR(191) NULL,
  `country_of_residence` VARCHAR(191) NULL,
  `source` VARCHAR(191) NULL,
  `did` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `issuer_credential_type_user_id_idx`(`user_id`),
  INDEX `issuer_credential_type_applicant_id_idx`(`applicant_id`),
  INDEX `issuer_credential_type_did_idx`(`did`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `issuer_credential_type` ADD CONSTRAINT `issuer_credential_type_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE; 