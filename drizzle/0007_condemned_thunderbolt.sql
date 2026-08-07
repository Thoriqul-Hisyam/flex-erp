CREATE UNIQUE INDEX "cust_inv_company_number_idx" ON "customer_invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "cust_pay_company_number_idx" ON "customer_payments" USING btree ("company_id","payment_number");--> statement-breakpoint
CREATE UNIQUE INDEX "do_company_number_idx" ON "delivery_orders" USING btree ("company_id","do_number");--> statement-breakpoint
CREATE UNIQUE INDEX "gr_company_number_idx" ON "goods_receipts" USING btree ("company_id","gr_number");--> statement-breakpoint
CREATE UNIQUE INDEX "po_company_number_idx" ON "purchase_orders" USING btree ("company_id","po_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_company_number_idx" ON "purchase_requests" USING btree ("company_id","pr_number");--> statement-breakpoint
CREATE UNIQUE INDEX "rfq_company_number_idx" ON "purchase_rfqs" USING btree ("company_id","rfq_number");--> statement-breakpoint
CREATE UNIQUE INDEX "so_company_number_idx" ON "sales_orders" USING btree ("company_id","so_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sq_company_number_idx" ON "sales_quotations" USING btree ("company_id","sq_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sup_inv_company_number_idx" ON "supplier_invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sup_pay_company_number_idx" ON "supplier_payments" USING btree ("company_id","payment_number");