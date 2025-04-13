/*
  Warnings:

  - You are about to drop the `kycdata` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `kycdata` DROP FOREIGN KEY `KycData_user_id_fkey`;

-- AlterTable
ALTER TABLE `issuer` ADD COLUMN `sumsub_applicant_id` VARCHAR(191) NULL,
    ADD COLUMN `sumsub_external_id` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `kycdata`;
