-- ============================================================
-- CUSTOM CHECK CONSTRAINTS FOR WAREHOUSE MANAGEMENT SYSTEM
-- ============================================================
-- This migration adds database-level CHECK constraints to enforce
-- business rules defined in the PRD at the database level.
--
-- IMPORTANT: Run this AFTER the initial Prisma migration.
--
-- To apply: Run `npx prisma db execute --file prisma/migrations/custom/add_check_constraints.sql --schema prisma/schema.prisma`
-- ============================================================

-- ------------------------------------------------------------
-- 1. MEMBER CODE FORMAT CONSTRAINT
-- ------------------------------------------------------------
-- PRD Requirement: Member code must be format PHW-XXXXXX
-- where X is alphanumeric (uppercase letters and digits only)
--
-- Pattern: PHW-[A-Z0-9]{6}
-- Examples: PHW-7F4K92, PHW-ABC123, PHW-000001

ALTER TABLE "User"
ADD CONSTRAINT "User_memberCode_format_check"
CHECK (memberCode ~ '^PHW-[A-Z0-9]{6}$');

-- ------------------------------------------------------------
-- 2. ORPHAN PARCEL EXCEPTION CONSTRAINT
-- ------------------------------------------------------------
-- PRD Requirement: "Parcel ownership is never guessed"
-- If a parcel has no owner (ownerId IS NULL), it MUST be
-- marked as an exception (hasException = true).
--
-- This prevents parcels from existing in the system without
-- a clear ownership path.

ALTER TABLE "Parcel"
ADD CONSTRAINT "Parcel_orphan_must_be_exception"
CHECK (
  (ownerId IS NOT NULL) OR (hasException = true)
);

-- ------------------------------------------------------------
-- 3. PAYMENT CONFIRMATION CONSISTENCY
-- ------------------------------------------------------------
-- Business Rule: If payment status is CONFIRMED, then:
-- - paymentConfirmedAt must be set
-- - paymentConfirmedById must be set (staff who confirmed)
--
-- This ensures audit trail completeness for payment confirmations.

ALTER TABLE "Delivery"
ADD CONSTRAINT "Delivery_payment_confirmed_audit_check"
CHECK (
  (paymentStatus != 'CONFIRMED') OR
  (paymentConfirmedAt IS NOT NULL AND paymentConfirmedById IS NOT NULL)
);

-- ------------------------------------------------------------
-- 4. EXCEPTION RESOLUTION CONSISTENCY
-- ------------------------------------------------------------
-- Business Rule: If exception status is RESOLVED, then:
-- - resolvedAt must be set
-- - handledById must be set (admin who resolved)
-- - resolution notes must be provided
--
-- This ensures proper documentation of all exception resolutions.

ALTER TABLE "Exception"
ADD CONSTRAINT "Exception_resolution_audit_check"
CHECK (
  (status != 'RESOLVED') OR
  (resolvedAt IS NOT NULL AND handledById IS NOT NULL AND resolution IS NOT NULL)
);

-- ------------------------------------------------------------
-- 5. PARCEL WEIGHT VALIDATION
-- ------------------------------------------------------------
-- Business Rule: Parcel weight must be positive and reasonable
-- Min: 0.01 kg (10 grams)
-- Max: 50 kg (typical warehouse limit)

ALTER TABLE "Parcel"
ADD CONSTRAINT "Parcel_weight_range_check"
CHECK (weight >= 0.01 AND weight <= 50.0);

-- ------------------------------------------------------------
-- 6. FEE CONFIGURATION VALIDATION
-- ------------------------------------------------------------
-- Business Rule: Fee configuration must have positive values
-- and valid weight ranges

ALTER TABLE "FeeConfiguration"
ADD CONSTRAINT "FeeConfiguration_positive_values_check"
CHECK (baseFee >= 0 AND perKgRate >= 0 AND minWeight >= 0);

ALTER TABLE "FeeConfiguration"
ADD CONSTRAINT "FeeConfiguration_weight_range_check"
CHECK (maxWeight IS NULL OR maxWeight > minWeight);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these to verify constraints were added successfully:
--
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = '"User"'::regclass AND contype = 'c';
--
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = '"Parcel"'::regclass AND contype = 'c';
--
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = '"Delivery"'::regclass AND contype = 'c';
--
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = '"Exception"'::regclass AND contype = 'c';
-- ============================================================
