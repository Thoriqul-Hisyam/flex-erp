"use client";

import * as React from "react";
import {
  UserCheck,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Edit3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { useToast } from "@/components/ui/toast";
import {
  fetchEmployeesAction,
  createEmployeeAction,
  updateEmployeeAction,
} from "@/app/actions/employee-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";

export default function EmployeesPage() {
  const permission = usePermission("md_employees");
  const { showToast } = useToast();

  const [employees, setEmployees] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [employeeCode, setEmployeeCode] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("Staff");
  const [departmentId, setDepartmentId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [status, setStatus] = React.useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchEmployeesAction();
    if (res.success && Array.isArray(res.data)) {
      setEmployees(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchRecordsAction("Department").then((r) => {
      if (r.success && Array.isArray(r.data)) setDepartments(r.data);
    });
    fetchRecordsAction("Branch").then((r) => {
      if (r.success && Array.isArray(r.data)) setBranches(r.data);
    });
    fetchRecordsAction("User").then((r) => {
      if (r.success && Array.isArray(r.data)) setUsers(r.data);
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Master Karyawan" roleName={permission.roleName} />;
  }

  const handleOpenAdd = () => {
    setEditingId(null);
    setName("");
    setEmployeeCode("");
    setEmail("");
    setPhone("");
    setJobTitle("Driver / Supir");
    setDepartmentId("");
    setBranchId("");
    setUserId("");
    setStatus("ACTIVE");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setEditingId(emp.id);
    setName(emp.name);
    setEmployeeCode(emp.employeeCode);
    setEmail(emp.email || "");
    setPhone(emp.phone || "");
    setJobTitle(emp.jobTitle || "Staff");
    setDepartmentId(emp.departmentId || "");
    setBranchId(emp.branchId || "");
    setUserId(emp.userId || "");
    setStatus(emp.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Nama Karyawan wajib diisi." });
      return;
    }

    setIsSubmitting(true);
    let res;
    if (editingId) {
      res = await updateEmployeeAction(editingId, {
        name,
        email,
        phone,
        jobTitle,
        departmentId,
        branchId,
        userId,
        status,
      });
    } else {
      res = await createEmployeeAction({
        name,
        employeeCode,
        email,
        phone,
        jobTitle,
        departmentId,
        branchId,
        userId,
      });
    }
    setIsSubmitting(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsModalOpen(false);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.jobTitle || "").toLowerCase().includes(q) ||
      (e.departmentName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Master Data</span>
            <span>/</span>
            <span>Data Karyawan</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-[#0088ff]" />
            Master Data Karyawan (Employees)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Direktori data karyawan perusahaan (Supir/Driver, Staff Logistik, Sales, Staff Operasional).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={handleOpenAdd}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" /> Tambah Karyawan Baru
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIK, jabatan, atau departemen..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">NIK / Kode</th>
                <th className="p-4">Nama Karyawan</th>
                <th className="p-4">Jabatan</th>
                <th className="p-4">Departemen & Cabang</th>
                <th className="p-4">Kontak</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Karyawan...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Belum ada data Karyawan.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="p-4 font-mono font-semibold text-[#0088ff]">{emp.employeeCode}</td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{emp.name}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-[#0088ff] px-2.5 py-1 rounded-full text-[11px] font-medium">
                        <Briefcase className="h-3 w-3" />
                        {emp.jobTitle}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {emp.departmentName}
                      </div>
                      <div className="text-[10px] text-[#8a94a6] flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-purple-500" />
                        {emp.branchName}
                      </div>
                    </td>
                    <td className="p-4 space-y-0.5 text-[#8a94a6]">
                      {emp.phone && (
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Phone className="h-3 w-3 text-emerald-500" />
                          {emp.phone}
                        </div>
                      )}
                      {emp.email && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <Mail className="h-3 w-3 text-blue-500" />
                          {emp.email}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Badge
                        variant={emp.status === "ACTIVE" ? "success" : "secondary"}
                        className="rounded-full text-[10px]"
                      >
                        {emp.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      {(permission.isSuperAdmin || permission.canUpdate) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(emp)}
                          className="h-8 w-8 p-0 rounded-full text-[#0088ff] hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Karyawan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#0088ff]" />
                {editingId ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Isi profil karyawan untuk digunakan di pengiriman, penugasan, dan operasional.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Pak Budi Santoso"
                  className="rounded-xl h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Jabatan / Posisi
                  </label>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Contoh: Driver / Supir Utama"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    No. Telepon / WA
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812..."
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Departemen
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="">-- Tanpa Departemen --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Cabang
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="">-- Semua Cabang --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="budi@lefatech.co.id"
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              {editingId && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0f2f7] dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full px-4 h-9 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-blue-500/20"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Karyawan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
