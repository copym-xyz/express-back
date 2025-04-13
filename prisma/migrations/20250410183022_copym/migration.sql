/*
  Warnings:

  - You are about to drop the `kyc` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `kyc` DROP FOREIGN KEY `KYC_user_id_fkey`;

-- DropTable
DROP TABLE `kyc`;
