export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "post"
  | "export"
  | "print";

export const ENTITY_TO_PAGE_KEY_MAP: Record<string, string> = {
  company: "md_companies",
  companies: "md_companies",
  branch: "md_branches",
  branches: "md_branches",
  warehouse: "md_warehouses",
  warehouses: "md_warehouses",
  productcategory: "md_categories",
  productcategories: "md_categories",
  category: "md_categories",
  categories: "md_categories",
  product: "md_products",
  products: "md_products",
  unit: "md_units",
  units: "md_units",
  department: "md_departments",
  departments: "md_departments",
  customer: "crm_customers",
  customers: "crm_customers",
  supplier: "crm_suppliers",
  suppliers: "crm_suppliers",
  tax: "md_taxes",
  taxes: "md_taxes",
  employee: "md_employees",
  employees: "md_employees",
  vehicle: "md_vehicles",
  vehicles: "md_vehicles",
  user: "sys_users",
  users: "sys_users",
  role: "sys_roles",
  roles: "sys_roles",
  audit: "sys_audit",
  auditlog: "sys_audit",
  auditlogs: "sys_audit",
  stock: "inv_stocks",
  stocks: "inv_stocks",
  movement: "inv_movements",
  movements: "inv_movements",
  adjustment: "inv_adjustments",
  adjustments: "inv_adjustments",
  transfer: "inv_transfers",
  transfers: "inv_transfers",
  batch: "inv_batches",
  batches: "inv_batches",
  opname: "inv_opnames",
  opnames: "inv_opnames",
  inventory: "inv_stocks",
  purchaserequest: "pur_requests",
  purchaserequests: "pur_requests",
  pr: "pur_requests",
  purchaseorder: "pur_orders",
  purchaseorders: "pur_orders",
  po: "pur_orders",
  goodsreceipt: "pur_receipts",
  goodsreceipts: "pur_receipts",
  gr: "pur_receipts",
  supplierinvoice: "pur_invoices",
  supplierinvoices: "pur_invoices",
  rfq: "pur_rfq",
  rfqs: "pur_rfq",
  purchaserfq: "pur_rfq",
  purchaserfqs: "pur_rfq",
  salesquotation: "sal_quotations",
  salesquotations: "sal_quotations",
  sq: "sal_quotations",
  salesorder: "sal_orders",
  salesorders: "sal_orders",
  so: "sal_orders",
  deliveryorder: "sal_deliveries",
  deliveryorders: "sal_deliveries",
  do: "sal_deliveries",
  customerinvoice: "sal_invoices",
  customerinvoices: "sal_invoices",
  purchasing: "pur_orders",
  dashboard: "dashboard",
};

export function resolvePageKey(entityOrPath: string): string {
  if (!entityOrPath) return "md_products";
  if (entityOrPath.includes("_")) return entityOrPath;

  const clean = entityOrPath.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ENTITY_TO_PAGE_KEY_MAP[clean]) {
    return ENTITY_TO_PAGE_KEY_MAP[clean];
  }

  // Fuzzy fallback for compound entity names (e.g. "salesQuotationItem").
  // Short abbreviation keys (po, pr, gr, do, sq, so, ...) are excluded here
  // because they collide with unrelated words ("emplo-YEE-DOc-ument" would
  // otherwise match "do" -> sal_deliveries) - they only resolve via the
  // exact match above.
  const candidates = Object.entries(ENTITY_TO_PAGE_KEY_MAP)
    .filter(([key]) => key.length >= 4)
    .sort(([a], [b]) => b.length - a.length);
  for (const [key, pageKey] of candidates) {
    if (clean.startsWith(key) || clean.includes(key)) return pageKey;
  }

  return entityOrPath;
}

export function actionAliases(action: PermissionAction): PermissionAction[] {
  if (action === "post") return ["post", "approve"];
  if (action === "print") return ["print", "export"];
  return [action];
}
