-- Marketing-site newsletter subscribers. Public data collected by the
-- `/api/newsletter/subscribe` route handler, which runs with the
-- service-role key. RLS is enabled with NO policies so the anon and
-- authenticated roles cannot read or write this table at all. Only
-- service-role can touch it (service-role bypasses RLS in Postgres).

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_key" ON "newsletter_subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_subscribers_subscribed_at_idx" ON "newsletter_subscribers" USING btree ("subscribed_at");