"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { ProductCategoryData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function ProductCategoriesPage() {
  const columns: Column<ProductCategoryData>[] = [
    {
      key: "code",
      header: "Category Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Category Name",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">{item.name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.description}</div>
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

  return (
    <MasterDataPage<ProductCategoryData>
      title="Product Categories Master Data"
      entityName="Product Category"
      description="Manage inventory product categories used across product catalogs and stock classifications."
      columns={columns}
      createFields={[
        { name: "code", label: "Category Code", required: true, placeholder: "CAT-HARDWARE" },
        { name: "name", label: "Category Display Name", required: true, placeholder: "Hardware Devices & Equipment" },
        { name: "description", label: "Description / Scope", type: "textarea", placeholder: "IT enterprise server hardware, racks, and accessories." },
      ]}
    />
  );
}
