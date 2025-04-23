-- Drop the existing foreign key constraint
ALTER TABLE `kyc_verifications` DROP FOREIGN KEY IF EXISTS `kyc_verifications_user_id_fkey`;

-- Add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE `kyc_verifications` ADD CONSTRAINT `kyc_verifications_user_id_fkey` 
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE; 