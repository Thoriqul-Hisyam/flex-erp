export interface SessionContext {
  tenantId: string;
  tenantCode: string;
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
  context: SessionContext;
}

export const defaultSession: UserSession = {
  user: {
    id: "usr_101",
    email: "admin@lefatech.co.id",
    name: "Alexander Wright",
    role: "Super Admin / Executive",
    avatarUrl: "/avatars/david-warner.png",
  },
  context: {
    tenantId: "tnt_lefatech",
    tenantCode: "LEFATECH-GLOBAL",
    companyId: "cmp_lefatech_id",
    companyName: "PT Lefatech Indonesia",
    branchId: "brn_lefatech_hq",
    branchName: "Lefatech Head Office Jakarta",
    warehouseId: "wh_lefatech_main",
    warehouseName: "Lefatech Central Warehouse",
  },
};
