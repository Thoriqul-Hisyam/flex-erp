"use client";

import * as React from "react";

export interface SiteSettings {
  id?: string;
  tenantId?: string;
  siteName: string;
  siteTitle: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  themeMode: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  currencySymbol: string;
  maintenanceMode: boolean;
}

interface SiteSettingsContextType {
  settings: SiteSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
  siteName: "Flex ERP",
  siteTitle: "Flex ERP Portal Sistem Terintegrasi",
  primaryColor: "#0088ff",
  accentColor: "#0077ee",
  themeMode: "dark",
  timezone: "Asia/Jakarta",
  dateFormat: "DD/MM/YYYY",
  currency: "IDR",
  currencySymbol: "Rp",
  maintenanceMode: false,
};

const SiteSettingsContext = React.createContext<SiteSettingsContextType>({
  settings: defaultSettings,
  isLoading: false,
  refreshSettings: async () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<SiteSettings>(defaultSettings);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchSettings = React.useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings({
            ...defaultSettings,
            ...data.settings,
          });
        }
      }
    } catch (err) {
      console.warn("Could not fetch site settings, using defaults.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Dynamically update document title and favicon in browser DOM
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Update Document Title
      if (settings.siteTitle) {
        document.title = settings.siteTitle;
      }

      // 2. Update Favicon Link Element
      const faviconSrc = settings.faviconUrl || settings.logoUrl;
      if (faviconSrc) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement("link");
          link.type = "image/x-icon";
          link.rel = "shortcut icon";
          document.getElementsByTagName("head")[0].appendChild(link);
        }
        link.href = faviconSrc;
      }
    }
  }, [settings.siteTitle, settings.faviconUrl, settings.logoUrl]);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return React.useContext(SiteSettingsContext);
}
