export type AdminPermissionKey =
  | "approveRegistrations"
  | "approvePasswordChanges"
  | "viewActivityLogs"
  | "manageUsers"
  | "manageAnnouncements"
  | "manageStickers"
  | "manageUpdateLogs"
  | "refreshGeoLocations"
  | "manageAI"
  | "manageSqlLab"

export type AdminPermissionMap = Record<AdminPermissionKey, boolean>

export const ADMIN_PERMISSION_DEFS: Array<{ key: AdminPermissionKey; label: string; description: string }> = [
  { key: "approveRegistrations", label: "注册审核", description: "同意新用户注册申请" },
  { key: "approvePasswordChanges", label: "密码修改", description: "审核用户密码修改申请" },
  { key: "viewActivityLogs", label: "活动日志", description: "查看登录与操作记录" },
  { key: "manageUsers", label: "成员管理", description: "修改成员角色并删除符合条件的用户" },
  { key: "manageAnnouncements", label: "公告广播", description: "发布或删除公告与世界频道广播" },
  { key: "manageStickers", label: "公共表情", description: "上传和删除公共表情包" },
  { key: "manageUpdateLogs", label: "更新日志", description: "管理公开更新日志展示" },
  { key: "refreshGeoLocations", label: "IP 地理位置", description: "刷新活动日志中的 IP 地理位置" },
  { key: "manageAI", label: "AI 助手", description: "审核 AI 申请并管理系统授信" },
  { key: "manageSqlLab", label: "SQL 实验室", description: "为成员开放数据库表/列的查询与执行权限" },
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
  manageAI: false,
  manageSqlLab: false,
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
  manageAI: true,
  manageSqlLab: true,
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
    manageAI: Boolean(value?.manageAI),
    manageSqlLab: Boolean(value?.manageSqlLab),
  }
}
