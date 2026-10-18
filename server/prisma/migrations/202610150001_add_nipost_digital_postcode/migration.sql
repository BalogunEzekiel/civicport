-- Add NIPOST Digital Postcode metadata to reports.
-- Existing reports are preserved; postcode fields remain nullable/false by default.
ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "digitalPostcode" TEXT,
  ADD COLUMN IF NOT EXISTS "postcodeVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "postcodeStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "postcodeLocationMatch" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "postcodeDistanceMeters" INTEGER,
  ADD COLUMN IF NOT EXISTS "postcodeLocationLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "postcodeVerifiedAt" TIMESTAMP(3);
