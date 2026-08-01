"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { CustomerData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default function CustomersPage() {
  const columns: Column<CustomerData>[] = [
    {
      key: "code",
      header: "Customer Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Customer Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.email}</div>
        </div>
      ),
    },
    {
      key: "creditLimit",
      header: "Credit Limit",
      align: "right",
      sortable: true,
      accessor: (item) => <span className="font-mono text-slate-700 dark:text-slate-300">{formatCurrency(Number(item.creditLimit || 0))}</span>,
    },
    {
      key: "balanceOutstanding",
      header: "Outstanding Balance",
      align: "right",
      sortable: true,
      accessor: (item) => (
        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
          {formatCurrency(Number(item.balanceOutstanding || 0))}
        </span>
      ),
    },
    {
      key: "paymentTerms",
      header: "Terms",
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
    <MasterDataPage<CustomerData>
      title="Customers Management"
      entityName="Customer"
      description="Manage enterprise customer accounts, credit limits, payment terms, and outstanding balances."
      columns={columns}
      createFields={[
        { name: "code", label: "Customer Code", required: true, placeholder: "CUST-10046" },
        { name: "name", label: "Company / Customer Name", required: true, placeholder: "Global Tech Inc" },
        { name: "email", label: "Billing Email", type: "email", required: true, placeholder: "invoices@globaltech.com" },
        { name: "phone", label: "Phone Number", placeholder: "+1 (555) 000-1122" },
        { name: "creditLimit", label: "Credit Limit (USD)", type: "number", required: true, placeholder: "100000" },
        { name: "paymentTerms", label: "Payment Terms (Net Days)", type: "number", required: true, placeholder: "30" },
        { name: "taxId", label: "Tax Identification ID", placeholder: "US-99821092-A" },
        { name: "city", label: "City & Country", placeholder: "New York, USA" },
      ]}
    />
  );
}
