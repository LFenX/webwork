export type AdminPermissionKey =
  | "approveRegistrations"
  | "approvePasswordChanges"
  | "viewActivityLogs"
  | "manageUsers"
  | "manageAnnouncements"
  | "manageStickers"
  | "manageUpdateLogs"
  | "refreshGeoLocations"

export type AdminPermissionMap = Record<AdminPermissionKey, boolean>

export const ADMIN_PERMISSION_DEFS: Array<{ key: AdminPermissionKey; label: string; description: string }> = [
  { key: "approveRegistrations", label: "注册审核", description: "同意新用户注册申请" },
  { key: "approvePasswordChanges", label: "密码修改", description: "同意用户修改或找回密码" },
  { key: "viewActivityLogs", label: "登录与操作日志", description: "查看用户登录、登出和操作记录" },
  { key: "manageUsers", label: "成员管理", description: "修改成员角色和删除符合条件的用户" },
  { key: "manageAnnouncements", label: "公告与广播", description: "发布、删除公告和世界频道广播历史" },
  { key: "manageStickers", label: "公用表情包", description: "上传和删除公用表情包" },
  { key: "manageUpdateLogs", label: "更新日志展示", description: "修改或隐藏公开更新日志" },
  { key: "refreshGeoLocations", label: "IP 地理位置", description: "刷新登录日志中的 IP 地理位置" },
]

export const EMPTY_ADMIN_PERMISSIONS: AdminPermissionMap = {
  approveRegistrations: false,
  approvePasswordChanges: false,
  viewActivityLogs: false,
  manageUsers: false,
  manageAnnouncements: false,
  manageStickers: false,
  manageUpdateLogs: false,
  refreshGeoLocations: false,
}

export const OWNER_ADMIN_PERMISSIONS: AdminPermissionMap = {
  approveRegistrations: true,
  approvePasswordChanges: true,
  viewActivityLogs: true,
  manageUsers: true,
  manageAnnouncements: true,
  manageStickers: true,
  manageUpdateLogs: true,
  refreshGeoLocations: true,
}

export function normalizeAdminPermissions(value?: Partial<Record<AdminPermissionKey, unknown>> | null): AdminPermissionMap {
  return {
    approveRegistrations: Boolean(value?.approveRegistrations),
    approvePasswordChanges: Boolean(value?.approvePasswordChanges),
    viewActivityLogs: Boolean(value?.viewActivityLogs),
    manageUsers: Boolean(value?.manageUsers),
    manageAnnouncements: Boolean(value?.manageAnnouncements),
    manageStickers: Boolean(value?.manageStickers),
    manageUpdateLogs: Boolean(value?.manageUpdateLogs),
    refreshGeoLocations: Boolean(value?.refreshGeoLocations),
  }
}
