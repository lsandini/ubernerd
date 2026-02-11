CREATE TABLE "attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"domain" text NOT NULL,
	"item_id" text NOT NULL,
	"served_at" integer NOT NULL,
	"answered_at" integer NOT NULL,
	"rt_ms" integer NOT NULL,
	"choice" integer NOT NULL,
	"correct" boolean NOT NULL,
	"score_delta" integer NOT NULL,
	"token" text,
	"platform" text,
	"app_version" text,
	"device_tz" text,
	"device_locale" text,
	"received_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"domain" text NOT NULL,
	"subdomain" text,
	"type" text NOT NULL,
	"diff" integer NOT NULL,
	"time_sec" integer NOT NULL,
	"prompt" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correct_enc" text NOT NULL,
	"rationale_enc" text NOT NULL,
	"media_url" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"display_from" integer NOT NULL,
	"display_to" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ladders" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"period" text NOT NULL,
	"cohort" text DEFAULT 'global' NOT NULL,
	"period_start" integer NOT NULL,
	"entries" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"locale" text NOT NULL,
	"valid_from" integer NOT NULL,
	"valid_to" integer NOT NULL,
	"etag" text,
	"sig" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_uuid_answered_idx" ON "attempts" USING btree ("uuid","answered_at");--> statement-breakpoint
CREATE INDEX "attempts_domain_answered_idx" ON "attempts" USING btree ("domain","answered_at");--> statement-breakpoint
CREATE INDEX "items_domain_display_idx" ON "items" USING btree ("domain","display_from");--> statement-breakpoint
CREATE INDEX "items_pack_idx" ON "items" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "ladders_domain_period_idx" ON "ladders" USING btree ("domain","period","cohort","period_start");