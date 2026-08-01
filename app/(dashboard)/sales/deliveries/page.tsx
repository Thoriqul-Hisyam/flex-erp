"use client";

import * as React from "react";
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Warehouse,
  Users,
  CheckCircle2,
  Calendar,
  Package,
  Printer,
} from "lucide-react";
import { DocumentPrintModal } from "@/components/ui/document-print-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { useToast } from "@/components/ui/toast";
import {
  fetchDeliveryOrdersAction,
  fetchSalesOrdersAction,
  createDeliveryOrderAction,
} from "@/app/actions/sales-actions";
import { fetchEmployeesAction } from "@/app/actions/employee-actions";
import { fetchVehiclesAction } from "@/app/actions/vehicle-actions";
import { formatNumber } from "@/lib/utils";

export default function DeliveryOrdersPage() {
  const permission = usePermission("sal_deliveries");
  const { showToast } = useToast();

  const [deliveries, setDeliveries] = React.useState<any[]>([]);
  const [confirmedOrders, setConfirmedOrders] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedSoId, setSelectedSoId] = React.useState("");
  const [selectedSo, setSelectedSo] = React.useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = React.useState("");
  const [driverName, setDriverName] = React.useState("");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState("");
  const [vehicleNumber, setVehicleNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{
      productId: string;
      productName: string;
      productSku: string;
      qtyOrdered: number;
      qtyShipped: number;
      batchNo?: string;
    }>
  >([]);
  const [isShipping, setIsShipping] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchDeliveryOrdersAction();
    if (res.success && Array.isArray(res.data)) {
      setDeliveries(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchSalesOrdersAction().then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setConfirmedOrders(
          r.data.filter(
            (so: any) => so.status === "CONFIRMED" || so.status === "PARTIALLY_DELIVERED"
          )
        );
      }
    });
    fetchEmployeesAction().then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setEmployees(r.data.filter((e: any) => e.status === "ACTIVE"));
      }
    });
    fetchVehiclesAction().then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setVehicles(r.data.filter((v: any) => v.status === "ACTIVE"));
      }
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Delivery Orders" roleName={permission.roleName} />;
  }

  const handleSoSelect = (soId: string) => {
    setSelectedSoId(soId);
    const so = confirmedOrders.find((s) => s.id === soId);
    setSelectedSo(so || null);

    if (so && so.items) {
      setItems(
        so.items.map((i: any) => ({
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku,
          qtyOrdered: i.qtyOrdered,
          qtyShipped: Math.max(i.qtyOrdered - (i.qtyDelivered || 0), 0),
          batchNo: `BATCH-${new Date().getFullYear()}-${i.productSku || "DO"}`,
        }))
      );
    } else {
      setItems([]);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCreateDo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSoId) {
      showToast({ type: "error", title: "Pilih SO", message: "Sales Order wajib dipilih." });
      return;
    }
    const validItems = items.filter((i) => i.qtyShipped > 0);
    if (validItems.length === 0) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Isi qty dikirim > 0 pada minimal 1 produk." });
      return;
    }

    setIsShipping(true);
    const res = await createDeliveryOrderAction({
      soId: selectedSoId,
      driverName: driverName || undefined,
      vehicleNumber: vehicleNumber || undefined,
      notes: notes || undefined,
      items: validItems,
    });
    setIsShipping(false);

    if (res.success) {
      showToast({ type: "success", title: "Stok Keluar Berhasil (Stock OUT)", message: res.message });
      setIsModalOpen(false);
      setSelectedSoId("");
      setSelectedSo(null);
      setDriverName("");
      setVehicleNumber("");
      setNotes("");
      setItems([]);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = deliveries.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.doNumber.toLowerCase().includes(q) ||
      d.soNumber.toLowerCase().includes(q) ||
      d.customerName.toLowerCase().includes(q) ||
      d.warehouseName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Sales</span>
            <span>/</span>
            <span>Delivery Orders</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-[#0088ff]" />
            Surat Jalan / Delivery Orders (Stock OUT)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Pencatatan pengiriman barang ke pelanggan (otomatis memicu Stock OUT & pengurangan stok gudang).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" /> Terbitkan Surat Jalan (Stock OUT)
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
            placeholder="Cari nomor DO, SO, customer, gudang..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] text-[11px] uppercase tracking-wider font-semibold">
                <th className="p-4">No. Surat Jalan (DO)</th>
                <th className="p-4">Ref Sales Order (SO)</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Gudang</th>
                <th className="p-4">Supir & Armada</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Total Item</th>
                <th className="p-4">Tgl Pengiriman</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 font-medium text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Surat Jalan...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Belum ada Surat Jalan (DO) diterbitkan.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="p-4 font-mono font-semibold text-[#0088ff]">{d.doNumber}</td>
                    <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      {d.soNumber}
                    </td>
                    <td className="p-4 font-medium flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#8a94a6]" />
                      {d.customerName}
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                        <Warehouse className="h-3.5 w-3.5 text-[#0088ff]" />
                        {d.warehouseName}
                      </span>
                    </td>
                    <td className="p-4">
                      <div>{d.driverName}</div>
                      <div className="text-[10px] text-[#8a94a6] font-mono">{d.vehicleNumber}</div>
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant="success" className="rounded-full text-[10px]">
                        {d.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center font-mono font-bold">{d.items?.length || 0} SKU</td>
                    <td className="p-4 text-[#8a94a6]">
                      {d.shippedAt ? new Date(d.shippedAt).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPrintDoc(d)}
                        className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                      >
                        <Printer className="h-3 w-3" /> Cetak Surat Jalan
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Terbitkan DO Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#0088ff]" />
                Terbitkan Surat Jalan (Delivery Order)
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Pilih Sales Order (SO) yang telah dikonfirmasi dan isi rincian kuantitas fisik dikirim.
              </p>
            </div>

            <form onSubmit={handleCreateDo} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Pilih Sales Order (SO) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSoId}
                  onChange={(e) => handleSoSelect(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Sales Order --</option>
                  {confirmedOrders.map((so) => (
                    <option key={so.id} value={so.id}>
                      {so.soNumber} — {so.customerName} ({so.warehouseName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSo && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div>
                    <span className="text-slate-500">Customer:</span>{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedSo.customerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Gudang Pengiriman:</span>{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedSo.warehouseName}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Supir / Pengantar (Master Karyawan)
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedDriverId(val);
                      if (val && val !== "CUSTOM") {
                        const emp = employees.find((x) => x.id === val);
                        if (emp) setDriverName(emp.name);
                      } else if (val === "") {
                        setDriverName("");
                      }
                    }}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="">-- Pilih dari Master Karyawan --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.jobTitle})
                      </option>
                    ))}
                    <option value="CUSTOM">-- Input Manual (Ekspedisi Luar) --</option>
                  </select>
                  {(selectedDriverId === "CUSTOM" || (!selectedDriverId && driverName)) && (
                    <Input
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Masukkan nama supir..."
                      className="rounded-xl h-8 text-xs mt-1"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Armada Kendaraan (Master Armada)
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedVehicleId(val);
                      if (val && val !== "CUSTOM") {
                        const v = vehicles.find((x) => x.id === val);
                        if (v) setVehicleNumber(v.plateNumber);
                      } else if (val === "") {
                        setVehicleNumber("");
                      }
                    }}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="">-- Pilih dari Master Armada --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} — {v.vehicleType} ({v.brandModel || "-"})
                      </option>
                    ))}
                    <option value="CUSTOM">-- Input Manual --</option>
                  </select>
                  {(selectedVehicleId === "CUSTOM" || (!selectedVehicleId && vehicleNumber)) && (
                    <Input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="Masukkan plat nomor..."
                      className="rounded-xl h-8 text-xs mt-1 font-mono uppercase font-bold"
                    />
                  )}
                </div>
              </div>

              {/* Items Table */}
              {items.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#f0f2f7] dark:border-slate-800">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Rincian Barang Dikirim (Memicu Stock OUT)
                  </label>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800"
                      >
                        <div className="col-span-5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-[#0088ff] font-mono">
                            {item.productSku} — Pesan: {item.qtyOrdered}
                          </div>
                        </div>

                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-500">Qty Dikirim</label>
                          <Input
                            type="number"
                            min={0}
                            max={item.qtyOrdered}
                            value={item.qtyShipped}
                            onChange={(e) =>
                              handleItemChange(index, "qtyShipped", parseFloat(e.target.value) || 0)
                            }
                            className="h-7 text-xs rounded-lg"
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="text-[10px] text-slate-500">Nomor Batch</label>
                          <Input
                            value={item.batchNo || ""}
                            onChange={(e) => handleItemChange(index, "batchNo", e.target.value)}
                            placeholder="Batch No"
                            className="h-7 text-xs rounded-lg font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catatan Pengiriman
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nomor resi, instruksi bongkar muat..."
                  className="rounded-xl h-9 text-xs"
                />
              </div>

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
                  disabled={isShipping}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-blue-500/20"
                >
                  {isShipping ? "Memproses..." : "Terbitkan Surat Jalan (Stock OUT)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="DO"
          documentNumber={printDoc.doNumber}
          date={printDoc.shippedAt ? new Date(printDoc.shippedAt).toLocaleDateString("id-ID") : "-"}
          partyName={printDoc.customerName || "Pelanggan Umum"}
          warehouseName={printDoc.warehouseName}
          driverName={printDoc.driverName}
          vehiclePlate={printDoc.vehicleNumber}
          notes={printDoc.notes}
          status={printDoc.status}
          items={printDoc.items ? printDoc.items.map((i: any) => ({
            productName: i.productName || "Produk",
            productSku: i.productSku || "",
            qty: i.qtyShipped || i.qtyOrdered || 1,
          })) : []}
        />
      )}
    </div>
  );
}
