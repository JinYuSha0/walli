CREATE TABLE IF NOT EXISTS "user" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"name" TEXT NOT NULL,
	"email" TEXT NOT NULL UNIQUE,
	"emailVerified" INTEGER NOT NULL,
	"image" TEXT,
	"createdAt" INTEGER NOT NULL,
	"updatedAt" INTEGER NOT NULL,
	"role" TEXT DEFAULT 'user',
	"banned" INTEGER DEFAULT 0,
	"banReason" TEXT,
	"banExpires" INTEGER
);

CREATE TABLE IF NOT EXISTS "session" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"userId" TEXT NOT NULL,
	"token" TEXT NOT NULL UNIQUE,
	"expiresAt" INTEGER NOT NULL,
	"ipAddress" TEXT,
	"userAgent" TEXT,
	"createdAt" INTEGER NOT NULL,
	"updatedAt" INTEGER NOT NULL,
	"impersonatedBy" TEXT,
	FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"userId" TEXT NOT NULL,
	"accountId" TEXT NOT NULL,
	"providerId" TEXT NOT NULL,
	"accessToken" TEXT,
	"refreshToken" TEXT,
	"accessTokenExpiresAt" INTEGER,
	"refreshTokenExpiresAt" INTEGER,
	"scope" TEXT,
	"idToken" TEXT,
	"password" TEXT,
	"createdAt" INTEGER NOT NULL,
	"updatedAt" INTEGER NOT NULL,
	FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "verification" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"identifier" TEXT NOT NULL,
	"value" TEXT NOT NULL,
	"expiresAt" INTEGER NOT NULL,
	"createdAt" INTEGER,
	"updatedAt" INTEGER
);
