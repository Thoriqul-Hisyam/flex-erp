ALTER TYPE "public"."RfqQuoteStatus" ADD VALUE 'INVITED' BEFORE 'SUBMITTED';--> statement-breakpoint
ALTER TABLE "rfq_quotes" ALTER COLUMN "status" SET DEFAULT 'INVITED';