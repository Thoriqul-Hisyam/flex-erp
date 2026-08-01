"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { CompanyData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function CompaniesPage() {
  const columns: Column<CompanyData>[] = [
    {
      key: "code",
      header: "Company Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Legal Entity Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.email}</div>
        </div>
      ),
    },
    {
      key: "taxId",
      header: "Tax Registration ID",
      accessor: (item) => <span className="font-mono text-slate-700 dark:text-slate-300">{item.taxId}</span>,
    },
    {
      key: "currency",
      header: "Base Currency",
      accessor: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.currency}
        </Badge>
      ),
    },
    {
      key: "branchesCount",
      header: "Branches",
      align: "center",
      accessor: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.branchesCount || 0} branches
        </Badge>
      ),
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
    <MasterDataPage<CompanyData>
      title="Companies Management"
      entityName="Company"
      description="Manage legal enterprise units, base currencies, and tax registration identifiers."
      columns={columns}
      createFields={[
        { name: "code", label: "Company Code (e.g. ACME-US)", required: true, placeholder: "ACME-US" },
        { name: "name", label: "Legal Entity Name", required: true, placeholder: "Acme Corp Ltd" },
        { name: "taxId", label: "Tax Identification Number", required: true, placeholder: "US-99824102-X" },
        { name: "email", label: "Official Email Address", type: "email", required: true, placeholder: "finance@company.com" },
        { name: "phone", label: "Phone Number", placeholder: "+1 (555) 000-0000" },
        {
          name: "currency",
          label: "Default Base Currency",
          type: "select",
          required: true,
          options: [
            { label: "USD - US Dollar", value: "USD" },
            { label: "EUR - Euro", value: "EUR" },
            { label: "SGD - Singapore Dollar", value: "SGD" },
            { label: "IDR - Indonesian Rupiah", value: "IDR" },
          ],
        },
      ]}
    />
  );
}
