-- Add lastUsed audit field to ExtensionToken
ALTER TABLE "ExtensionToken" ADD COLUMN "lastUsed" TIMESTAMP(3);
