-- AlterTable: Add scopes column to ExtensionToken
ALTER TABLE "ExtensionToken" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: OAuth Authorization Codes for PKCE flow
CREATE TABLE "oauth_authorization_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[],
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorization_codes_code_key" ON "oauth_authorization_codes"("code");
CREATE INDEX "oauth_authorization_codes_code_idx" ON "oauth_authorization_codes"("code");
CREATE INDEX "oauth_authorization_codes_userId_idx" ON "oauth_authorization_codes"("userId");

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on new table
ALTER TABLE "oauth_authorization_codes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_codes_user_isolation" ON "oauth_authorization_codes"
  USING ("userId" = current_setting('app.current_user_id', true));
