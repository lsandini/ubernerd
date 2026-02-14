CREATE TABLE "aliases" (
	"uuid" text PRIMARY KEY NOT NULL,
	"alias" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
