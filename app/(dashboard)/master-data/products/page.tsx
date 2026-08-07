"use client";

import * as React from "react";
import { Warehouse } from "lucide-react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { ProductData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default function ProductsPage() {
  const [categories, setCategories] = React.useState<
    { label: string; value: string }[]
  >([]);
  const [warehouses, setWarehouses] = React.useState<
    { label: string; value: string }[]
  >([]);
  const [units, setUnits] = React.useState<{ label: string; value: string }[]>(
    [],
  );

  const loadOptions = React.useCallback(() => {
    fetchRecordsAction("Product Category").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCategories(
          res.data.map((cat: any) => ({
            label: cat.name ? `${cat.name} (${cat.code})` : cat.code,
            value: cat.id,
          })),
        );
      }
    });

    fetchRecordsAction("Warehouse").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setWarehouses(
          res.data.map((wh: any) => ({
            label: wh.name || wh.code,
            value: wh.id,
          })),
        );
      }
    });

    // Master Units -> Product UOM dropdown (link Products to Master Unit data)
    fetchRecordsAction("Unit").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setUnits(
          res.data.map((u: any) => ({
            label: u.name ? `${u.name} (${u.code})` : u.code,
            value: u.code || u.name,
          })),
        );
      }
    });
  }, []);

  React.useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const columns: Column<ProductData>[] = [
    {
      key: "sku",
      header: "SKU / Code",
      sortable: true,
      accessor: (item) => (
        <span className="font-bold text-[#0f172a] dark:text-white font-mono">
          {item.sku}
        </span>
      ),
    },
    {
      key: "name",
      header: "Product Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">
            {item.name}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {item.category}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      align: "center",
      accessor: (item) => (
        <Badge
          variant={
            item.type === "GOODS"
              ? "default"
              : item.type === "SERVICE"
                ? "secondary"
                : "outline"
          }
          className="text-[10px]"
        >
          {item.type}
        </Badge>
      ),
    },
    {
      key: "unit",
      header: "UOM",
      align: "center",
      accessor: (item) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {item.unit}
        </span>
      ),
    },
    {
      key: "costPrice",
      header: "Cost Price",
      align: "right",
      sortable: true,
      accessor: (item) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {formatCurrency(item.costPrice)}
        </span>
      ),
    },
    {
      key: "sellingPrice",
      header: "Selling Price",
      align: "right",
      sortable: true,
      accessor: (item) => (
        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(item.sellingPrice)}
        </span>
      ),
    },
    {
      key: "stockOnHand",
      header: "Initial Stock & Warehouse",
      align: "right",
      sortable: true,
      accessor: (item) => (
        <div className="text-right">
          <div
            className={`font-mono font-bold ${item.stockOnHand <= item.reorderLevel && item.type === "GOODS" ? "text-rose-600 dark:text-rose-400" : "text-[#0f172a] dark:text-slate-200"}`}
          >
            {formatNumber(item.stockOnHand)} {item.unit}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium flex items-center gap-1">
            <Warehouse className="h-3 w-3" /> {item.defaultWarehouse || "Gudang Utama Jakarta"}
          </div>
        </div>
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

  const createFields = React.useMemo(
    () => [
      {
        name: "sku",
        label: "Product SKU Code",
        required: true,
        placeholder: "PRD-CPU-9900K",
      },
      {
        name: "name",
        label: "Product Name",
        required: true,
        placeholder: "Enterprise Server Module",
      },
      {
        name: "categoryId",
        label: "Category",
        type: "select" as const,
        required: true,
        options: categories,
      },
      {
        name: "type",
        label: "Item Type",
        type: "select" as const,
        required: true,
        options: [
          { label: "Finished Goods", value: "GOODS" },
          { label: "Service / Hourly", value: "SERVICE" },
          { label: "Raw Material", value: "RAW_MATERIAL" },
        ],
      },
      {
        name: "unit",
        label: "Unit of Measure (UOM)",
        type: "select" as const,
        required: true,
        options: units,
      },
      {
        name: "costPrice",
        label: "Standard Cost Price ($)",
        type: "number" as const,
        required: true,
        placeholder: "100.00",
      },
      {
        name: "sellingPrice",
        label: "List Selling Price ($)",
        type: "number" as const,
        required: true,
        placeholder: "250.00",
      },
      {
        name: "stockOnHand",
        label: "Initial Stock Quantity (Saldo Awal)",
        type: "number" as const,
        placeholder: "0",
        disabledOnEdit: true,
      },
      {
        name: "warehouseId",
        label: "Default Warehouse (Gudang Saldo Awal)",
        type: "select" as const,
        options: warehouses,
        disabledOnEdit: true,
      },
      {
        name: "reorderLevel",
        label: "Reorder Warning Threshold",
        type: "number" as const,
        placeholder: "20",
      },
    ],
    [categories, warehouses, units],
  );

  return (
    <MasterDataPage<ProductData>
      title="Products & Service Items"
      entityName="Product"
      description="Manage SKU inventory catalog, raw materials, selling rates, and reorder levels."
      columns={columns}
      createFields={createFields}
    />
  );
}
