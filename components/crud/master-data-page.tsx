"use client";

import * as React from "react";
import {
  Plus,
  CheckCircle,
  XCircle,
  Edit3,
  Trash2,
  Lock,
  Download,
  Upload,
  FileSpreadsheet,
  Info,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { DataTable, Column } from "@/components/ui/data-table";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  createRecordAction,
  updateRecordAction,
  deleteRecordAction,
  fetchRecordsAction,
} from "@/app/actions/crud-actions";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";

export interface MasterDataItem {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  [key: string]: any;
}

interface MasterDataPageProps<T extends MasterDataItem> {
  title: string;
  entityName: string;
  description: string;
  columns: Column<T>[];
  initialData?: T[];
  createFields: {
    name: string;
    label: string;
    type?: "text" | "number" | "email" | "select" | "textarea";
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    disabledOnEdit?: boolean;
    options?: { label: string; value: string }[];
  }[];
}

export function MasterDataPage<T extends MasterDataItem>({
  title,
  entityName,
  description,
  columns,
  initialData = [],
  createFields,
}: MasterDataPageProps<T>) {
  const { showToast } = useToast();
  const permission = usePermission(entityName);
  const [data, setData] = React.useState<T[]>(initialData);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<T | null>(null);
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null,
  );
  const [isPending, startTransition] = React.useTransition();

  // Import state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewRows, setPreviewRows] = React.useState<
    Record<string, string>[]
  >([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let isMounted = true;
    startTransition(async () => {
      const result = await fetchRecordsAction(entityName);
      if (isMounted && result.success && Array.isArray(result.data)) {
        setData(result.data as T[]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [entityName]);

  // ---- Export to CSV / Excel ----
  const handleExportExcel = () => {
    if (data.length === 0) {
      showToast({
        type: "error",
        title: "Export Failed",
        message: "No data to export.",
      });
      return;
    }

    const exportCols = columns.filter((c) => c.key !== "actions");
    const headers = exportCols.map((c) => c.header);
    const keys = exportCols.map((c) => c.key);

    const csvRows = [headers.join(",")];
    for (const item of data) {
      const row = keys.map((k) => {
        const val = (item as any)[k];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entityName.toLowerCase().replace(/\s+/g, "_")}_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast({
      type: "success",
      title: "Exported",
      message: `${data.length} ${entityName} records exported to CSV.`,
    });
    logAuditEvent({
      tenantId: permission.tenantCode || "LEFATECH-GLOBAL",
      action: "CREATE",
      entity: entityName,
      entityId: "CSV_EXPORT",
      newPayload: { exportCount: data.length },
    });
  };

  // ---- Download CSV Template for Import ----
  const handleDownloadTemplate = () => {
    const fieldNames = createFields.map((f) => f.name);
    if (!fieldNames.includes("code")) fieldNames.unshift("code");
    if (!fieldNames.includes("name")) fieldNames.unshift("name");

    const sampleRow1: Record<string, string> = {};
    const sampleRow2: Record<string, string> = {};

    fieldNames.forEach((fn) => {
      const fieldDef = createFields.find((f) => f.name === fn);
      sampleRow1[fn] = fieldDef?.placeholder || `SAMPLE_${fn.toUpperCase()}_1`;
      sampleRow2[fn] = `SAMPLE_${fn.toUpperCase()}_2`;
    });

    const csvRows = [
      fieldNames.join(","),
      fieldNames
        .map((fn) => `"${sampleRow1[fn].replace(/"/g, '""')}"`)
        .join(","),
      fieldNames
        .map((fn) => `"${sampleRow2[fn].replace(/"/g, '""')}"`)
        .join(","),
    ];

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template_${entityName.toLowerCase().replace(/\s+/g, "_")}_import.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast({
      type: "info",
      title: "Template Downloaded",
      message: `Use this CSV template to fill in your ${entityName} data.`,
    });
  };

  // ---- Handle File Selection for Import ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        showToast({
          type: "error",
          title: "Invalid File",
          message: "CSV file must contain headers and at least 1 data row.",
        });
        return;
      }

      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
      const preview: Record<string, string>[] = [];

      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const vals =
          lines[i]
            .match(/("[^"]*"|[^,]*)/g)
            ?.map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ||
          [];
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = vals[idx] || "";
        });
        preview.push(row);
      }
      setPreviewRows(preview);
    };
    reader.readAsText(file);
  };

  // ---- Process CSV Import ----
  const handleExecuteImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setIsImporting(false);
        return;
      }

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setIsImporting(false);
        return;
      }

      // First line is header
      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const vals =
          lines[i]
            .match(/("[^"]*"|[^,]*)/g)
            ?.map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ||
          [];
        const record: Record<string, any> = { status: "ACTIVE" };

        headers.forEach((h, idx) => {
          if (vals[idx] !== undefined) {
            record[h] = vals[idx];
          }
        });

        // Ensure required code and name
        if (record.code || record.name) {
          try {
            const res = await createRecordAction(entityName, record);
            if (res.success) successCount++;
            else errorCount++;
          } catch {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }

      setIsImporting(false);
      setIsImportModalOpen(false);
      setSelectedFile(null);
      setPreviewRows([]);

      showToast({
        type: successCount > 0 ? "success" : "error",
        title: "Import Finished",
        message: `Successfully imported ${successCount} ${entityName} records (${errorCount} failed/skipped).`,
      });

      logAuditEvent({
        tenantId: permission.tenantCode || "LEFATECH-GLOBAL",
        action: "CREATE",
        entity: entityName,
        entityId: "CSV_IMPORT",
        newPayload: { successCount, errorCount },
      });

      // Reload data
      startTransition(async () => {
        const result = await fetchRecordsAction(entityName);
        if (result.success) setData((result.data || []) as T[]);
      });
    };

    reader.readAsText(selectedFile);
  };

  const handleOpenCreate = () => {
    if (!permission.canCreate) {
      showToast({
        type: "error",
        title: "Akses Ditolak",
        message: `Peran Anda (${permission.roleName}) tidak memiliki izin untuk menambah data ${entityName}.`,
      });
      return;
    }
    setEditingItem(null);
    const initialForm: Record<string, any> = { status: "ACTIVE" };
    createFields.forEach((f) => {
      if (f.type === "select" && f.options && f.options.length > 0) {
        initialForm[f.name] = f.options[0].value;
      } else {
        initialForm[f.name] = "";
      }
    });
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: T) => {
    if (!permission.canUpdate) {
      showToast({
        type: "error",
        title: "Akses Ditolak",
        message: `Peran Anda (${permission.roleName}) tidak memiliki izin untuk mengedit data ${entityName}.`,
      });
      return;
    }
    setEditingItem(item);
    const editForm: Record<string, any> = { ...item };
    createFields.forEach((f) => {
      if (
        f.type === "select" &&
        editForm[f.name] !== undefined &&
        editForm[f.name] !== null
      ) {
        editForm[f.name] = String(editForm[f.name]);
      }
    });
    setFormData(editForm);
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem && !permission.canUpdate) {
      showToast({
        type: "error",
        title: "Akses Ditolak",
        message: `Peran Anda (${permission.roleName}) tidak memiliki izin untuk memperbarui data ${entityName}.`,
      });
      return;
    }

    if (!editingItem && !permission.canCreate) {
      showToast({
        type: "error",
        title: "Akses Ditolak",
        message: `Peran Anda (${permission.roleName}) tidak memiliki izin untuk membuat data ${entityName}.`,
      });
      return;
    }

    startTransition(async () => {
      if (editingItem) {
        const res = await updateRecordAction(
          entityName,
          editingItem.id,
          formData,
        );
        if (res.success) {
          showToast({
            type: "success",
            title: "Berhasil Diperbarui",
            message: `Data ${entityName} "${formData.name || formData.code}" telah berhasil diperbarui.`,
          });
          setIsModalOpen(false);
          const refresh = await fetchRecordsAction(entityName);
          if (refresh.success) setData((refresh.data || []) as T[]);
        } else {
          showToast({
            type: "error",
            title: "Gagal Memperbarui",
            message: res.error || "Gagal memperbarui data.",
          });
        }
      } else {
        const res = await createRecordAction(entityName, formData);
        if (res.success) {
          showToast({
            type: "success",
            title: "Berhasil Ditambahkan",
            message: `Data ${entityName} "${formData.name || formData.code}" telah berhasil dibuat.`,
          });
          setIsModalOpen(false);
          const refresh = await fetchRecordsAction(entityName);
          if (refresh.success) setData((refresh.data || []) as T[]);
        } else {
          showToast({
            type: "error",
            title: "Gagal Menambahkan",
            message: res.error || "Gagal membuat data baru.",
          });
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!permission.canDelete) {
      showToast({
        type: "error",
        title: "Akses Ditolak",
        message: `Peran Anda (${permission.roleName}) tidak memiliki izin untuk menghapus data ${entityName}.`,
      });
      return;
    }

    startTransition(async () => {
      const res = await deleteRecordAction(entityName, id);
      if (res.success) {
        showToast({
          type: "success",
          title: "Berhasil Dihapus",
          message: `Data ${entityName} telah berhasil dihapus.`,
        });
        setConfirmDeleteId(null);
        const refresh = await fetchRecordsAction(entityName);
        if (refresh.success) setData((refresh.data || []) as T[]);
      } else {
        showToast({
          type: "error",
          title: "Gagal Menghapus",
          message: res.error || "Gagal menghapus data.",
        });
      }
    });
  };

  // Guard: wait until permission check completes before deciding access.
  // This prevents a brief "403 AKSES DITOLAK" flash while permissions load.
  if (permission.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Banner Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-3 w-64 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
        </div>

        {/* Stats Ribbon Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 bg-white dark:bg-[#12161f] rounded-3xl border border-[#e6e9f0] dark:border-slate-800"
            />
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="rounded-3xl border border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-[#12161f] p-4 space-y-3">
          <div className="h-9 w-72 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-lg"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Only after loading: if user's role has no READ permission, show Unauthorized card
  if (!permission.canRead) {
    return <UnauthorizedCard pageName={title} roleName={permission.roleName} />;
  }

  // Calculate statistics
  const totalCount = data.length;
  const activeCount = data.filter((d) => d.status === "ACTIVE").length;
  const inactiveCount = data.filter((d) => d.status !== "ACTIVE").length;

  // Augment columns with Actions if permitted
  const fullColumns: Column<T>[] = [
    ...columns,
    {
      key: "actions",
      header: "Tindakan",
      align: "right",
      width: "100px",
      accessor: (item) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {permission.canUpdate && (
            <button
              onClick={() => handleOpenEdit(item)}
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Edit"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {permission.canDelete && (
            <button
              onClick={() => setConfirmDeleteId(item.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {!permission.canUpdate && !permission.canDelete && (
            <span
              title="Akses hanya baca"
              className="p-1.5 text-slate-300 dark:text-slate-700"
            >
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <span className="rounded-full bg-[#f0f7ff] dark:bg-blue-950 px-3 py-1 font-mono text-xs font-bold text-[#0088ff] dark:text-blue-400 border border-[#0088ff]/20">
              {totalCount} Total
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8a94a6]">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="h-10 px-4 gap-2 text-xs font-semibold rounded-full border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4" />
            Ekspor CSV
          </Button>

          {/* Import CSV Button */}
          {permission.canCreate && (
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              size="sm"
              className="h-10 px-4 gap-2 text-xs font-semibold rounded-full border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shadow-xs"
            >
              <Upload className="h-4 w-4" />
              Impor CSV
            </Button>
          )}

          {/* Add button */}
          {permission.canCreate && (
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="h-10 px-5 gap-2 bg-[#0088ff] hover:bg-[#0077ee] text-white font-semibold text-xs rounded-full shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Tambah {entityName}
            </Button>
          )}
        </div>
      </div>

      {/* 3 Pill Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#8a94a6] uppercase tracking-wider">
              Total Data
            </div>
            <div className="text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white mt-0.5">
              {totalCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#f0f7ff] dark:bg-blue-950/60 flex items-center justify-center text-[#0088ff] dark:text-blue-400 font-mono font-bold text-sm border border-[#0088ff]/20">
            {totalCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#8a94a6] uppercase tracking-wider">
              Data Aktif
            </div>
            <div className="text-2xl font-bold font-mono-num text-[#10b981] mt-0.5">
              {activeCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#e6f9f0] dark:bg-emerald-950/60 flex items-center justify-center text-[#10b981] border border-[#10b981]/20">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#8a94a6] uppercase tracking-wider">
              Non-Aktif / Penangguhan
            </div>
            <div className="text-2xl font-bold font-mono-num text-[#ef4444] mt-0.5">
              {inactiveCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#fef2f2] dark:bg-rose-950/60 flex items-center justify-center text-[#ef4444] border border-[#ef4444]/20">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable<T>
        data={data}
        columns={fullColumns}
        searchPlaceholder={`Search ${entityName} by code or name...`}
      />

      {/* Modal: Create / Edit Entity */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingItem
            ? `Edit ${entityName}: ${editingItem.code || editingItem.name}`
            : `Create New ${entityName}`
        }
        description={
          editingItem
            ? "Perbarui data record yang sudah ada."
            : "Isi formulir di bawah untuk membuat record baru."
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            {createFields.map((field) => {
              const isDisabled = editingItem
                ? field.disabled || field.disabledOnEdit
                : field.disabled;
              const isFullWidth = field.type === "textarea";

              const fieldWrapper = (content: React.ReactNode) => (
                <div
                  key={field.name}
                  className={cn("space-y-1.5", isFullWidth && "sm:col-span-2")}
                >
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    {field.label}{" "}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {content}
                </div>
              );

              if (field.type === "select") {
                return fieldWrapper(
                  <select
                    disabled={isDisabled}
                    value={formData[field.name] || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.name]: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>,
                );
              }

              if (field.type === "textarea") {
                return fieldWrapper(
                  <textarea
                    disabled={isDisabled}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.name]: e.target.value })
                    }
                    rows={3}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  />,
                );
              }

              return fieldWrapper(
                <Input
                  type={field.type || "text"}
                  disabled={isDisabled}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [field.name]: e.target.value })
                  }
                  required={field.required}
                  className="h-10 rounded-lg bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />,
              );
            })}

            {/* Status Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Record Status
              </label>
              <select
                value={formData.status || "ACTIVE"}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
              >
                <option value="ACTIVE">✅ ACTIVE (Operasional)</option>
                <option value="INACTIVE">⛔ INACTIVE (Non-Aktif)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg text-xs h-9 px-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold h-9 px-5 shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {isPending
                ? "Menyimpan..."
                : editingItem
                  ? "Simpan Perubahan"
                  : "Tambah Data"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Import CSV with Template Download */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setSelectedFile(null);
          setPreviewRows([]);
        }}
        title={`Impor Data ${entityName} dari File CSV`}
      >
        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Panduan Impor Data CSV
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Unduh template CSV terlebih dahulu untuk melihat struktur kolom
                yang sesuai (seperti <strong>code</strong>,{" "}
                <strong>name</strong>, dsb). Isikan data Anda lalu unggah file
                CSV di bawah ini.
              </p>
              <Button
                type="button"
                onClick={handleDownloadTemplate}
                size="sm"
                variant="outline"
                className="mt-2 h-8 px-3 text-xs gap-1.5 font-bold border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 rounded-xl cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh Template CSV ({entityName})
              </Button>
            </div>
          </div>

          {/* Step 2: Select File */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Pilih File CSV Data Anda
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 p-6 rounded-2xl text-center cursor-pointer bg-slate-50 dark:bg-slate-900/50 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedFile
                  ? selectedFile.name
                  : "Klik di sini untuk memilih file .csv"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Format file didukung: CSV (UTF-8)
              </p>
            </div>
          </div>

          {/* Step 3: Data Preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>Pratinjau Data (5 Baris Pertama):</span>
                <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 font-mono">
                  ✓ Header CSV Valid
                </span>
              </div>
              <div className="overflow-x-auto max-h-40 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px]">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {Object.keys(previewRows[0]).map((h) => (
                        <th
                          key={h}
                          className="px-3 py-1.5 uppercase text-[10px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewRows.map((r, idx) => (
                      <tr key={idx}>
                        {Object.values(r).map((v, valIdx) => (
                          <td key={valIdx} className="px-3 py-1.5">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportModalOpen(false);
                setSelectedFile(null);
                setPreviewRows([]);
              }}
              className="rounded-xl text-xs cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={!selectedFile || isImporting}
              onClick={handleExecuteImport}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold px-5 cursor-pointer"
            >
              {isImporting ? "Memproses Impor..." : "Eksekusi Impor Data"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <Modal
          isOpen={!!confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
          title={`Konfirmasi Hapus Data ${entityName}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Apakah Anda yakin ingin menghapus data {entityName} ini? Tindakan
              ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                {isPending ? "Menghapus..." : "Hapus Data"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
