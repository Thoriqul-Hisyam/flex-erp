import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Query Default Tenant
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.code, "LEFATECH-GLOBAL"));

    if (!tenant) {
      return NextResponse.json(
        { success: false, message: "Tenant LEFATECH-GLOBAL tidak ditemukan." },
        { status: 404 }
      );
    }

    // 2. Query Site Settings for Tenant
    let [settings] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.tenantId, tenant.id));

    // Fallback if settings record hasn't been created yet in DB
    if (!settings) {
      [settings] = await db
        .insert(schema.siteSettings)
        .values({
          tenantId: tenant.id,
          siteName: "Flex ERP",
          siteTitle: "Flex ERP - Enterprise Portal PT Lefatech Indonesia",
          logoUrl: "/logo/logo.png",
          faviconUrl: "/logo/logo.png",
          primaryColor: "#0284c7",
          accentColor: "#0369a1",
          themeMode: "dark",
          timezone: "Asia/Jakarta",
          dateFormat: "DD/MM/YYYY",
          currency: "IDR",
          currencySymbol: "Rp",
          maintenanceMode: false,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
      },
      settings,
    });
  } catch (error) {
    console.error("GET /api/settings Error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil konfigurasi Site Settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Query Default Tenant
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.code, "LEFATECH-GLOBAL"));

    if (!tenant) {
      return NextResponse.json(
        { success: false, message: "Tenant tidak ditemukan." },
        { status: 404 }
      );
    }

    // 2. Upsert Site Settings for Tenant using Drizzle ORM
    let [existing] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.tenantId, tenant.id));

    let updatedSettings;

    if (existing) {
      [updatedSettings] = await db
        .update(schema.siteSettings)
        .set({
          siteName: body.siteName ?? existing.siteName,
          siteTitle: body.siteTitle ?? existing.siteTitle,
          logoUrl: body.logoUrl ?? existing.logoUrl ?? "/logo/logo.png",
          faviconUrl: body.faviconUrl ?? existing.faviconUrl ?? "/logo/logo.png",
          primaryColor: body.primaryColor ?? existing.primaryColor,
          accentColor: body.accentColor ?? existing.accentColor,
          themeMode: body.themeMode ?? existing.themeMode,
          timezone: body.timezone ?? existing.timezone,
          dateFormat: body.dateFormat ?? existing.dateFormat,
          currency: body.currency ?? existing.currency,
          currencySymbol: body.currencySymbol ?? existing.currencySymbol,
          maintenanceMode: body.maintenanceMode ?? existing.maintenanceMode,
          updatedAt: new Date(),
        })
        .where(eq(schema.siteSettings.id, existing.id))
        .returning();
    } else {
      [updatedSettings] = await db
        .insert(schema.siteSettings)
        .values({
          tenantId: tenant.id,
          siteName: body.siteName || "Flex ERP",
          siteTitle: body.siteTitle || "Flex ERP Enterprise Portal",
          logoUrl: body.logoUrl || "/logo/logo.png",
          faviconUrl: body.faviconUrl || "/logo/logo.png",
          primaryColor: body.primaryColor || "#0284c7",
          accentColor: body.accentColor || "#0369a1",
          themeMode: body.themeMode || "dark",
          timezone: body.timezone || "Asia/Jakarta",
          dateFormat: body.dateFormat || "DD/MM/YYYY",
          currency: body.currency || "IDR",
          currencySymbol: body.currencySymbol || "Rp",
          maintenanceMode: Boolean(body.maintenanceMode),
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      message: "Site Settings PT Lefatech Indonesia berhasil diperbarui!",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("POST /api/settings Error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memperbarui Site Settings." },
      { status: 500 }
    );
  }
}
