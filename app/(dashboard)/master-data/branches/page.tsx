"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { BranchData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { fetchRecordsAction } from "@/app/actions/crud-actions";

export default function BranchesPage() {
  const [companies, setCompanies] = React.useState<{ label: string; value: string }[]>([]);

  const loadCompanies = React.useCallback(() => {
    fetchRecordsAction("Company").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCompanies(
          res.data.map((c: any) => ({
            label: c.name || c.code,
            value: c.id,
          }))
        );
      }
    });
  }, []);

  React.useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const columns: Column<BranchData>[] = [
    {
      key: "code",
      header: "Branch Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Branch Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.city}</div>
        </div>
      ),
    },
    {
      key: "companyName",
      header: "Parent Company",
      accessor: (item) => <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.companyName}</span>,
    },
    {
      key: "isHeadquarters",
      header: "Type",
      align: "center",
      accessor: (item) => {
        const isHq = item.isHeadquarters === true || String(item.isHeadquarters) === "true";
        return (
          <Badge variant={isHq ? "default" : "outline"} className="text-[10px]">
            {isHq ? "Headquarters" : "Branch Office"}
          </Badge>
        );
      },
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

  const createFields = React.useMemo(() => [
    { name: "code", label: "Branch Code", required: true, placeholder: "BR-NY-HQ" },
    { name: "name", label: "Branch Office Name", required: true, placeholder: "New York HQ" },
    {
      name: "companyId",
      label: "Parent Company",
      type: "select" as const,
      required: true,
      options: companies,
    },
    {
      name: "isHeadquarters",
      label: "Branch Type",
      type: "select" as const,
      required: true,
      options: [
        { label: "Branch Office (Kantor Cabang)", value: "false" },
        { label: "Headquarters (Kantor Pusat)", value: "true" },
      ],
    },
    { name: "city", label: "City & Location", required: true, placeholder: "New York, NY" },
    { name: "phone", label: "Contact Phone", placeholder: "+1 (212) 555-0100" },
  ], [companies]);

  return (
    <MasterDataPage<BranchData>
      title="Branch Offices"
      entityName="Branch"
      description="Manage regional office locations, headquarters, and operational branches."
      columns={columns}
      createFields={createFields}
    />
  );
}
