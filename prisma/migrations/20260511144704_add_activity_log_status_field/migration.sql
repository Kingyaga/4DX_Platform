-- CreateEnum
CREATE TYPE "ActivityLogStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "status" "ActivityLogStatus" NOT NULL DEFAULT 'PENDING';
