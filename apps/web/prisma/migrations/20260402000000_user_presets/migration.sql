-- Create enum for user preset types
CREATE TYPE "public"."PresetType" AS ENUM ('TAG', 'ICON');

-- Create table for persistent user presets (tags/icons)
CREATE TABLE "public"."UserPreset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "public"."PresetType" NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserPreset_userId_type_idx" ON "public"."UserPreset"("userId", "type");
CREATE UNIQUE INDEX "UserPreset_userId_type_value_key" ON "public"."UserPreset"("userId", "type", "value");

ALTER TABLE "public"."UserPreset"
ADD CONSTRAINT "UserPreset_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
