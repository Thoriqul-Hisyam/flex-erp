"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { WarehouseData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { fetchRecordsAction } from "@/app/actions/crud-actions";

export default function WarehousesPage() {
  const [companies, setCompanies] = React.useState<{ label: string; value: string }[]>([]);
  const [branches, setBranches] = React.useState<{ label: string; value: string }[]>([]);

  const loadOptions = React.useCallback(() => {
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

    fetchRecordsAction("Branch").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setBranches(
          res.data.map((b: any) => ({
            label: b.name || b.code,
            value: b.id,
          }))
        );
      }
    });
  }, []);

  React.useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const columns: Column<WarehouseData>[] = [
    {
      key: "code",
      header: "Warehouse Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Warehouse Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.location}</div>
        </div>
      ),
    },
    {
      key: "companyName",
      header: "Company & Branch",
      accessor: (item) => (
        <div>
          <div className="font-semibold text-slate-700 dark:text-slate-300">{item.companyName}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.branchName}</div>
        </div>
      ),
    },
    {
      key: "capacityUtilization",
      header: "Capacity Utilization",
      align: "center",
      accessor: (item) => {
        const val = Number(item.capacityUtilization) || 0;
        const colorClass = val > 85 ? "bg-rose-500" : val > 70 ? "bg-amber-500" : "bg-emerald-500";
        return (
          <div className="flex items-center justify-center gap-2 font-mono">
            <div className="w-20 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                style={{ width: `${Math.min(val, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[36px]">{val}%</span>
          </div>
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
    { name: "code", label: "Warehouse Code", required: true, placeholder: "WH-NJ-MAIN" },
    { name: "name", label: "Warehouse Name", required: true, placeholder: "New Jersey Distribution Center" },
    {
      name: "companyId",
      label: "Associated Company",
      type: "select" as const,
      required: true,
      options: companies,
    },
    {
      name: "branchId",
      label: "Associated Branch Office",
      type: "select" as const,
      required: true,
      options: branches,
    },
    { name: "location", label: "Physical Location / Address", required: true, placeholder: "Edison, NJ" },
    { name: "capacityUtilization", label: "Initial Capacity Utilization (%)", type: "number" as const, placeholder: "45" },
  ], [companies, branches]);

  return (
    <MasterDataPage<WarehouseData>
      title="Warehouses & Logistics Hubs"
      entityName="Warehouse"
      description="Configure storage facilities, inventory capacity, and default fulfillment hubs."
      columns={columns}
      createFields={createFields}
    />
  );
}
