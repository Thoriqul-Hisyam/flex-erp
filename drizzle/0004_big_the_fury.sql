CREATE TYPE "public"."RfqQuoteStatus" AS ENUM('SUBMITTED', 'AWARDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."RfqStatus" AS ENUM('DRAFT', 'SENT', 'QUOTED', 'AWARDED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOGIN';--> statement-breakpoint
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOGIN_FAILED';--> statement-breakpoint
CREATE TABLE "purchase_rfq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"rfq_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_requested" numeric(15, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"rfq_number" varchar(50) NOT NULL,
	"pr_id" uuid,
	"status" "RfqStatus" DEFAULT 'DRAFT' NOT NULL,
	"due_date" timestamp with time zone,
	"notes" text,
	"created_by_id" uuid,
	"cancel_reason" text,
	"cancelled_by_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rfq_quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"qty" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"rfq_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "RfqQuoteStatus" DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_at" timestamp with time zone,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "emp_code_idx";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "high_value_po_threshold" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD COLUMN "do_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_rfq_items" ADD CONSTRAINT "purchase_rfq_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_items" ADD CONSTRAINT "purchase_rfq_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_items" ADD CONSTRAINT "purchase_rfq_items_rfq_id_purchase_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."purchase_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_items" ADD CONSTRAINT "purchase_rfq_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_pr_id_purchase_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."purchase_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfqs" ADD CONSTRAINT "purchase_rfqs_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quote_items" ADD CONSTRAINT "rfq_quote_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quote_items" ADD CONSTRAINT "rfq_quote_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quote_items" ADD CONSTRAINT "rfq_quote_items_quote_id_rfq_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."rfq_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quote_items" ADD CONSTRAINT "rfq_quote_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_rfq_id_purchase_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."purchase_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rfq_item_rfq_idx" ON "purchase_rfq_items" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "rfq_tenant_company_idx" ON "purchase_rfqs" USING btree ("tenant_id","company_id");--> statement-breakpoint
CREATE INDEX "rfq_pr_idx" ON "purchase_rfqs" USING btree ("pr_id");--> statement-breakpoint
CREATE INDEX "rfq_quote_item_quote_idx" ON "rfq_quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "rfq_quote_rfq_idx" ON "rfq_quotes" USING btree ("rfq_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rfq_quote_rfq_supplier_idx" ON "rfq_quotes" USING btree ("rfq_id","supplier_id");--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_do_id_delivery_orders_id_fk" FOREIGN KEY ("do_id") REFERENCES "public"."delivery_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_company_code_idx" ON "customers" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "emp_company_code_idx" ON "employees" USING btree ("company_id","employee_code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_code_idx" ON "products" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_sku_idx" ON "products" USING btree ("company_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_company_code_idx" ON "suppliers" USING btree ("company_id","code");