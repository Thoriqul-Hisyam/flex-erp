"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { SupplierData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function SuppliersPage() {
  const columns: Column<SupplierData>[] = [
    {
      key: "code",
      header: "Supplier Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Supplier Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.email}</div>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Performance Score",
      align: "center",
      accessor: (item) => (
        <Badge variant="outline" className="font-mono text-xs border-amber-500/40 text-amber-600 dark:text-amber-300">
          ★ {item.rating} / 5.0
        </Badge>
      ),
    },
    {
      key: "paymentTerms",
      header: "Payment Terms",
      align: "center",
      accessor: (item) => <span className="font-mono text-[#0f172a] dark:text-slate-200">Net {item.paymentTerms}d</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      accessor: (item) => (
        <Badge variant={item.status === "ACTIVE" ? "success" : "secondary"}>
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <MasterDataPage<SupplierData>
      title="Suppliers & Vendor Directory"
      entityName="Supplier"
      description="Manage raw material vendors, hardware suppliers, and procurement payment terms."
      columns={columns}
      createFields={[
        { name: "code", label: "Supplier Code", required: true, placeholder: "SUP-8004" },
        { name: "name", label: "Vendor Company Name", required: true, placeholder: "Precision Fab Inc" },
        { name: "email", label: "Procurement Email", type: "email", required: true, placeholder: "orders@vendor.com" },
        { name: "phone", label: "Contact Phone", placeholder: "+1 (555) 888-0011" },
        { name: "paymentTerms", label: "Payment Terms (Net Days)", type: "number", required: true, placeholder: "30" },
        { name: "city", label: "City & Country", placeholder: "San Jose, CA" },
      ]}
    />
  );
}
