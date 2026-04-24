import "server-only"
import { prisma } from "@/lib/db"
import { getUserAdminInfo } from "@/lib/admin"
import { maskIpAddress } from "@/lib/ai/tools/context"
import { summarizeGeoLocation, toolGranted, toolNotFound } from "@/lib/ai/tools/helpers"

function normalizeLimit(limit: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(limit)) return fallback
  return Math.min(Math.max(Math.trunc(limit as number), 1), max)
}

function normalizeCursor(cursor: string | undefined) {
  const parsed = Number(cursor ?? "0")
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

function paginate<T>(items: T[], limit: number, cursor?: string) {
  const offset = normalizeCursor(cursor)
  const page = items.slice(offset, offset + limit)
  return {
    items: page,
    nextCursor: items.length > offset + limit ? String(offset + page.length) : null,
    hasMore: items.length > offset + limit,
  }
}

export const getAdminSelfPermissionsTool = {
  name: "get_admin_self_permissions",
  title: "读取我的管理员权限",
  description: "读取当前管理员自己的角色和管理员权限。",
  execute: async ({ userId }: { userId: string }) => {
    const admin = await getUserAdminInfo(userId)
    if (!admin) return toolNotFound("当前用户不存在。", "admin_user_not_found")

    return toolGranted("已读取当前管理员权限。", {
      id: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      role: admin.role,
      permissions: admin.permissions,
    })
  },
}

export const listAdminUsersTool = {
  name: "list_admin_users",
  title: "列出后台用户",
  description: "以管理员权限列出后台可管理的用户列表。",
  execute: async ({
    limit,
    cursor,
    query,
  }: {
    limit?: number
    cursor?: string
    query?: string
  }) => {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        bio: true,
        location: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    const filtered = query
      ? rows.filter((item) => [item.email, item.displayName, item.bio, item.location, item.role].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()))
      : rows
    const page = paginate(filtered, normalizeLimit(limit, 20, 50), cursor)

    return toolGranted(`已列出 ${page.items.length} 位后台用户。`, {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        lastLoginAt: item.lastLoginAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  },
}

export const getAdminUserDetailTool = {
  name: "get_admin_user_detail",
  title: "读取后台用户详情",
  description: "以管理员权限读取某位用户的资料、管理员权限和 AI 授权状态。",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const [user, adminInfo, grant, request] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          displayName: true,
          bio: true,
          location: true,
          avatarText: true,
          avatarUrl: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      getUserAdminInfo(targetUserId),
      prisma.aIUsageGrant.findUnique({
        where: { userId: targetUserId },
        select: {
          status: true,
          providerLabel: true,
          baseUrl: true,
          apiKeyMask: true,
          model: true,
          streamEnabled: true,
          updatedAt: true,
        },
      }),
      prisma.aIAccessRequest.findFirst({
        where: { userId: targetUserId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          message: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
    ])

    if (!user) return toolNotFound("目标用户不存在。", "target_user_not_found", { targetUserId })

    return toolGranted(`已读取用户 ${user.displayName || user.email} 的后台详情。`, {
      user: {
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      adminPermissions: adminInfo?.permissions ?? null,
      aiGrant: grant
        ? {
            ...grant,
            updatedAt: grant.updatedAt.toISOString(),
          }
        : null,
      latestAccessRequest: request
        ? {
            ...request,
            createdAt: request.createdAt.toISOString(),
            reviewedAt: request.reviewedAt?.toISOString() ?? null,
          }
        : null,
    })
  },
}

export const listAdminUserSessionsTool = {
  name: "list_admin_user_sessions",
  title: "读取后台用户会话",
  description: "以管理员权限读取某位用户的登录会话记录。",
  execute: async ({
    targetUserId,
    limit,
    cursor,
  }: {
    targetUserId: string
    limit?: number
    cursor?: string
  }) => {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true },
    })
    if (!user) return toolNotFound("目标用户不存在。", "target_user_not_found", { targetUserId })

    const rows = await prisma.userSession.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      select: {
        sessionId: true,
        status: true,
        ipAddress: true,
        geoLocation: true,
        deviceInfo: true,
        lastSeenAt: true,
        lastActiveAt: true,
        loggedOutAt: true,
        logoutReason: true,
        createdAt: true,
      },
    })
    const page = paginate(rows, normalizeLimit(limit, 20, 50), cursor)

    return toolGranted(`已读取 ${page.items.length} 条用户会话记录。`, {
      user,
      ...page,
      items: page.items.map((item) => ({
        sessionId: item.sessionId,
        status: item.status,
        ipAddress: maskIpAddress(item.ipAddress),
        geoLocation: summarizeGeoLocation(item.geoLocation),
        deviceInfo: item.deviceInfo,
        lastSeenAt: item.lastSeenAt.toISOString(),
        lastActiveAt: item.lastActiveAt.toISOString(),
        loggedOutAt: item.loggedOutAt?.toISOString() ?? null,
        logoutReason: item.logoutReason,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  },
}

export const listAdminUserActivityLogsTool = {
  name: "list_admin_user_activity_logs",
  title: "读取后台用户活动日志",
  description: "以管理员权限读取某位用户的活动日志。",
  execute: async ({
    targetUserId,
    limit,
    cursor,
  }: {
    targetUserId: string
    limit?: number
    cursor?: string
  }) => {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true },
    })
    if (!user) return toolNotFound("目标用户不存在。", "target_user_not_found", { targetUserId })

    const rows = await prisma.userActivity.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        detail: true,
        ipAddress: true,
        geoLocation: true,
        deviceInfo: true,
        createdAt: true,
      },
    })
    const page = paginate(rows, normalizeLimit(limit, 20, 50), cursor)

    return toolGranted(`已读取 ${page.items.length} 条用户活动日志。`, {
      user,
      ...page,
      items: page.items.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        ipAddress: maskIpAddress(item.ipAddress),
        geoLocation: summarizeGeoLocation(item.geoLocation),
        deviceInfo: item.deviceInfo,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  },
}

export const listAdminAIAccessRequestsTool = {
  name: "list_admin_ai_access_requests",
  title: "列出 AI 访问申请",
  description: "读取后台 AI 访问申请记录。",
  execute: async ({ limit, cursor, status }: { limit?: number; cursor?: string; status?: string }) => {
    const rows = await prisma.aIAccessRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        reviewedBy: { select: { id: true, email: true, displayName: true } },
      },
    })
    const page = paginate(rows, normalizeLimit(limit, 20, 50), cursor)

    return toolGranted(`已读取 ${page.items.length} 条 AI 访问申请。`, {
      ...page,
      items: page.items.map((item) => ({
        id: item.id,
        status: item.status,
        message: item.message,
        reviewNote: item.reviewNote,
        createdAt: item.createdAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        user: item.user,
        reviewedBy: item.reviewedBy,
      })),
    })
  },
}

export const listAdminAIGrantsTool = {
  name: "list_admin_ai_grants",
  title: "列出 AI 授权记录",
  description: "读取后台 AI 使用授权记录。",
  execute: async ({ limit, cursor, status }: { limit?: number; cursor?: string; status?: string }) => {
    const rows = await prisma.aIUsageGrant.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    })
    const page = paginate(rows, normalizeLimit(limit, 20, 50), cursor)

    return toolGranted(`已读取 ${page.items.length} 条 AI 授权记录。`, {
      ...page,
      items: page.items.map((item) => ({
        id: item.id,
        userId: item.userId,
        status: item.status,
        providerLabel: item.providerLabel,
        baseUrl: item.baseUrl,
        apiKeyMask: item.apiKeyMask,
        model: item.model,
        temperature: item.temperature,
        streamEnabled: item.streamEnabled,
        updatedAt: item.updatedAt.toISOString(),
        revokedAt: item.revokedAt?.toISOString() ?? null,
        user: item.user,
      })),
    })
  },
}

export const listAdminAIAuditLogsTool = {
  name: "list_admin_ai_audit_logs",
  title: "列出 AI 审计日志",
  description: "读取后台 AI 审计日志，可按目标用户筛选。",
  execute: async ({
    limit,
    cursor,
    targetUserId,
  }: {
    limit?: number
    cursor?: string
    targetUserId?: string
  }) => {
    const rows = await prisma.aIAuditLog.findMany({
      where: targetUserId ? { targetUserId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, email: true, displayName: true } },
      },
    })
    const page = paginate(rows, normalizeLimit(limit, 20, 50), cursor)

    return toolGranted(`已读取 ${page.items.length} 条 AI 审计日志。`, {
      ...page,
      items: page.items.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        targetUserId: item.targetUserId,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
        actor: item.actor,
      })),
    })
  },
}

export const getAdminOverviewTool = {
  name: "get_admin_overview",
  title: "读取后台总览",
  description: "汇总后台用户、活动、AI 授权与申请等核心统计。",
  execute: async () => {
    const [userCount, activeGrantCount, requestCounts, auditCount, activityCount] = await Promise.all([
      prisma.user.count(),
      prisma.aIUsageGrant.count({ where: { status: "active" } }),
      prisma.aIAccessRequest.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.aIAuditLog.count(),
      prisma.userActivity.count(),
    ])

    return toolGranted("已汇总后台总览数据。", {
      userCount,
      activeGrantCount,
      auditCount,
      activityCount,
      requestCounts: requestCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all
        return acc
      }, {}),
    })
  },
}
