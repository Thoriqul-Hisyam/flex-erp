"use client";

import * as React from "react";
import {
  Car,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Edit3,
  Truck,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { useToast } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchVehiclesAction,
  createVehicleAction,
  updateVehicleAction,
} from "@/app/actions/vehicle-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";

export default function VehiclesPage() {
  const permission = usePermission("md_vehicles");
  const { showToast } = useToast();

  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [plateNumber, setPlateNumber] = React.useState("");
  const [vehicleCode, setVehicleCode] = React.useState("");
  const [vehicleType, setVehicleType] = React.useState("Truck Box");
  const [brandModel, setBrandModel] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState<"ACTIVE" | "MAINTENANCE" | "INACTIVE">("ACTIVE");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchVehiclesAction();
    if (res.success && Array.isArray(res.data)) {
      setVehicles(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchRecordsAction("Branch").then((r) => {
      if (r.success && Array.isArray(r.data)) setBranches(r.data);
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Armada Kendaraan" roleName={permission.roleName} />;
  }

  const handleOpenAdd = () => {
    setEditingId(null);
    setPlateNumber("");
    setVehicleCode("");
    setVehicleType("Truck Box");
    setBrandModel("");
    setBranchId("");
    setNotes("");
    setStatus("ACTIVE");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: any) => {
    setEditingId(v.id);
    setPlateNumber(v.plateNumber);
    setVehicleCode(v.vehicleCode);
    setVehicleType(v.vehicleType || "Truck Box");
    setBrandModel(v.brandModel || "");
    setBranchId(v.branchId || "");
    setNotes(v.notes || "");
    setStatus(v.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Nomor Polisi (Plat Nomor) wajib diisi." });
      return;
    }

    setIsSubmitting(true);
    let res;
    if (editingId) {
      res = await updateVehicleAction(editingId, {
        plateNumber,
        vehicleType,
        brandModel,
        branchId,
        notes,
        status,
      });
    } else {
      res = await createVehicleAction({
        plateNumber,
        vehicleCode,
        vehicleType,
        brandModel,
        branchId,
        notes,
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

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.plateNumber.toLowerCase().includes(q) ||
      v.vehicleCode.toLowerCase().includes(q) ||
      (v.vehicleType || "").toLowerCase().includes(q) ||
      (v.brandModel || "").toLowerCase().includes(q)
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
            <span>Armada Kendaraan</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <Car className="h-6 w-6 text-[#0088ff]" />
            Master Armada & Kendaraan Operasional (Vehicles)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Direktori armada kendaraan pengiriman (Truck Box, Blind Van, Pickup Cargo, Kendaraan Operational).
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
              <Plus className="h-4 w-4" /> Tambah Armada Baru
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
            placeholder="Cari plat nomor, kode armada, merk, atau jenis..."
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
                <th className="p-4">Kode Armada</th>
                <th className="p-4">Plat Nomor (No. Polisi)</th>
                <th className="p-4">Tipe & Merk Kendaraan</th>
                <th className="p-4">Cabang Penempatan</th>
                <th className="p-4">Catatan / Spesifikasi</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Armada Kendaraan...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Belum ada data Kendaraan Armada.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="p-4 font-mono font-semibold text-[#0088ff]">{v.vehicleCode}</td>
                    <td className="p-4 font-mono font-bold text-slate-900 dark:text-white text-sm">
                      <span className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                        {v.plateNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {v.vehicleType}
                      </div>
                      <div className="text-[10px] text-[#8a94a6] font-medium">{v.brandModel || "-"}</div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-purple-500" />
                        {v.branchName}
                      </span>
                    </td>
                    <td className="p-4 text-[#8a94a6] text-xs max-w-xs truncate">{v.notes || "-"}</td>
                    <td className="p-4 text-center">
                      <Badge
                        variant={
                          v.status === "ACTIVE"
                            ? "success"
                            : v.status === "MAINTENANCE"
                            ? "warning"
                            : "secondary"
                        }
                        className="rounded-full text-[10px]"
                      >
                        {v.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      {(permission.isSuperAdmin || permission.canUpdate) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(v)}
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

      {/* Modal Tambah/Edit Armada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <Car className="h-5 w-5 text-[#0088ff]" />
                {editingId ? "Edit Kendaraan Armada" : "Tambah Armada Baru"}
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Isi plat nomor dan spesifikasi armada untuk dipilih saat menerbitkan Surat Jalan (DO).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Plat Nomor (No. Polisi) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="Contoh: B 9123 SCN"
                    className="rounded-xl h-9 text-xs font-mono font-bold uppercase"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Jenis / Tipe Armada
                  </label>
                  <SearchableSelect
                    value={vehicleType}
                    onChange={setVehicleType}
                    options={[
                      { value: "Truck Box", label: "Truck Box Alumunium" },
                      { value: "Pickup Cargo", label: "Pickup Cargo / Bak" },
                      { value: "Blind Van Express", label: "Blind Van Express" },
                      { value: "Motorized Courier", label: "Motor Pengantar" },
                      { value: "Operational Car", label: "Mobil Operasional" },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Merk / Model Kendaraan
                  </label>
                  <Input
                    value={brandModel}
                    onChange={(e) => setBrandModel(e.target.value)}
                    placeholder="Contoh: Isuzu Elf NMR 71"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Cabang Penempatan
                  </label>
                  <SearchableSelect
                    value={branchId}
                    onChange={setBranchId}
                    options={[
                      { value: "", label: "-- Semua Cabang (Tidak Dibatasi) --" },
                      ...branches.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                    placeholder="-- Semua Cabang --"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catatan / Spesifikasi Armada
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kapasitas muat 5 ton, status servis..."
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              {editingId && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Status Armada
                  </label>
                  <SearchableSelect
                    value={status}
                    onChange={(val) => setStatus(val as any)}
                    options={[
                      { value: "ACTIVE", label: "ACTIVE (Siap Operasional)" },
                      { value: "MAINTENANCE", label: "MAINTENANCE (Dalam Perbaikan/Servis)" },
                      { value: "INACTIVE", label: "INACTIVE" },
                    ]}
                  />
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
                  {isSubmitting ? "Menyimpan..." : "Simpan Kendaraan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
