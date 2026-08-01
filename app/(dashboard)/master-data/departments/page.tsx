"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { DepartmentData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function DepartmentsPage() {
  const columns: Column<DepartmentData>[] = [
    {
      key: "code",
      header: "Kode Departemen",
      sortable: true,
      accessor: (item) => (
        <span className="font-bold text-[#0f172a] dark:text-white font-mono">
          {item.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nama Departemen / Divisi",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200">
            {item.name}
          </div>
          {item.description && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {item.description}
            </div>
          )}
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
    <MasterDataPage<DepartmentData>
      title="Master Data Departemen & Divisi"
      entityName="Department"
      description="Kelola daftar departemen dan divisi perusahaan untuk pengelompokan pengadaan (PR) dan operasional."
      columns={columns}
      createFields={[
        {
          name: "code",
          label: "Kode Departemen",
          required: true,
          placeholder: "DEP-LOGISTICS",
        },
        {
          name: "name",
          label: "Nama Departemen",
          required: true,
          placeholder: "Gudang & Logistik",
        },
        {
          name: "description",
          label: "Deskripsi",
          type: "textarea",
          placeholder: "Divisi pengelolaan pergudangan dan pengadaan pasokan.",
        },
      ]}
    />
  );
}
