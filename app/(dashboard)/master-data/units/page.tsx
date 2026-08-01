"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { UnitData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function UnitsPage() {
  const columns: Column<UnitData>[] = [
    {
      key: "code",
      header: "Unit Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Unit Name",
      sortable: true,
      accessor: (item) => <span className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</span>,
    },
    {
      key: "symbol",
      header: "Symbol",
      align: "center",
      accessor: (item) => (
        <Badge variant="outline" className="font-mono text-xs border-blue-500/40 text-blue-600 dark:text-blue-300">
          {item.symbol || item.code}
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
    <MasterDataPage<UnitData>
      title="Units of Measurement"
      entityName="Unit"
      description="Manage product units of measurement (PCS, BOX, KG, SET, etc)."
      columns={columns}
      createFields={[
        { name: "code", label: "Unit Code", required: true, placeholder: "PCS" },
        { name: "name", label: "Unit Name", required: true, placeholder: "Pieces" },
        { name: "symbol", label: "Symbol / Abbreviation", placeholder: "pcs" },
      ]}
    />
  );
}
