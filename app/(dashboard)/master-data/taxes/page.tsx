"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

import { TaxData } from "@/lib/types/entities";

export default function TaxesPage() {
  const columns: Column<TaxData>[] = [
    {
      key: "code",
      header: "Tax Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Tax Name",
      sortable: true,
      accessor: (item) => <span className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</span>,
    },
    {
      key: "rate",
      header: "Tax Rate (%)",
      align: "center",
      sortable: true,
      accessor: (item) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{Number(item.rate).toFixed(2)}%</span>,
    },
    {
      key: "type",
      header: "Calculation Type",
      align: "center",
      accessor: (item) => (
        <Badge variant={item.type === "EXCLUSIVE" ? "default" : "secondary"} className="text-[10px]">
          {item.type}
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
    <MasterDataPage<TaxData>
      title="Taxes & Fiscal Rates Configuration"
      entityName="Tax"
      description="Configure VAT, Sales Taxes, export zero-rates, and financial ledger tax calculation rules."
      columns={columns}
      createFields={[
        { name: "code", label: "Tax Code (e.g. VAT11)", required: true, placeholder: "PPN11" },
        { name: "name", label: "Tax Description / Name", required: true, placeholder: "Value Added Tax 11%" },
        { name: "rate", label: "Tax Rate Percentage (%)", type: "number", required: true, placeholder: "11.00" },
        {
          name: "type",
          label: "Calculation Rule",
          type: "select",
          required: true,
          options: [
            { label: "Tax Exclusive (Added to Subtotal)", value: "EXCLUSIVE" },
            { label: "Tax Inclusive (Embedded in Subtotal)", value: "INCLUSIVE" },
          ],
        },
      ]}
    />
  );
}
