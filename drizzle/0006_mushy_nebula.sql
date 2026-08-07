ALTER TABLE "supplier_invoices" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "cancelled_by_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "is_finalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "finalized_by_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "cancelled_by_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_finalized_by_id_users_id_fk" FOREIGN KEY ("finalized_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;