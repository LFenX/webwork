export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

type Dictionary = {
  common: {
    back: string
    save: string
    saving: string
    cancel: string
    refresh: string
    loading: string
    settings: string
  }
  nav: {
    home: string
    resume: string
    blog: string
    daily: string
    reflections: string
    notes: string
    jobs: string
    interviews: string
    ai: string
    friends: string
    admin: string
    login: string
    logout: string
    settings: string
  }
  settings: {
    title: string
    description: string
    profile: string
    profileDesc: string
    password: string
    passwordDesc: string
    privacy: string
    privacyDesc: string
    language: string
    languageDesc: string
    profileTitle: string
    passwordTitle: string
    privacyTitle: string
    languageTitle: string
    displayName: string
    avatarText: string
    avatarUpload: string
    location: string
    bio: string
    email: string
    profileSaved: string
    profileSaveFailed: string
    avatarImageOnly: string
    avatarTooLarge: string
    passwordInput: string
    passwordSubmit: string
    passwordStatus: string
    passwordRequested: string
    passwordRequestFailed: string
    passwordNoRequest: string
    passwordApproved: string
    passwordPending: string
    passwordRejected: string
    visibilityHint: string
    privateVisibility: string
    friendsVisibility: string
    languageHint: string
    chinese: string
    english: string
    languageSaved: string
  }
  channels: {
    channels: string
    membersCount: (count: number) => string
    allUsers: string
    channelMessagesHint: string
    invite: string
    manage: string
    send: string
    sending: string
    empty: string
    typeMessage: string
    publishToFeed: string
    loadFailed: string
    createGroup: string
    groupInfo: string
    groupName: string
    groupAnnouncement: string
    groupOwner: string
    groupMembers: string
    removeMember: string
    leaveGroup: string
    dissolveGroup: string
    saveGroup: string
    savedGroup: string
    removedMember: string
    leftGroup: string
    dissolvedGroup: string
    worldReadonly: string
    ownerOnly: string
    noAnnouncement: string
    manageHiddenForWorld: string
    confirmRemove: (name: string) => string
    confirmLeave: string
    confirmDissolve: string
    notFound: string
    openGroupInfo: string
  }
}

const zhCN: Dictionary = {
  common: {
    back: "返回",
    save: "保存",
    saving: "保存中",
    cancel: "取消",
    refresh: "刷新",
    loading: "加载中",
    settings: "设置",
  },
  nav: {
    home: "首页",
    resume: "简历",
    blog: "博客",
    daily: "日常",
    reflections: "心得",
    notes: "笔记",
    jobs: "求职",
    interviews: "面试",
    ai: "AI 助手",
    friends: "好友",
    admin: "管理",
    login: "登录",
    logout: "退出登录",
    settings: "设置",
  },
  settings: {
    title: "设置中心",
    description: "管理个人资料、密码审批、展示权限和语言偏好。",
    profile: "个人资料",
    profileDesc: "修改昵称、头像、地区、简介和邮箱。",
    password: "密码更改",
    passwordDesc: "提交密码更改申请并查看审批状态。",
    privacy: "资料展示权限",
    privacyDesc: "统一管理各个模块对好友的可见性。",
    language: "语言",
    languageDesc: "切换中文与英文界面。",
    profileTitle: "个人资料设置",
    passwordTitle: "密码更改",
    privacyTitle: "资料展示权限",
    languageTitle: "语言设置",
    displayName: "昵称",
    avatarText: "默认头像文字",
    avatarUpload: "上传头像",
    location: "地区",
    bio: "简介",
    email: "邮箱",
    profileSaved: "个人资料已保存",
    profileSaveFailed: "保存资料失败",
    avatarImageOnly: "请选择图片文件",
    avatarTooLarge: "头像图片不能超过 5MB",
    passwordInput: "请输入新密码",
    passwordSubmit: "提交审批申请",
    passwordStatus: "查看审批状态",
    passwordRequested: "密码更改申请已提交，等待管理员审批",
    passwordRequestFailed: "提交密码更改申请失败",
    passwordNoRequest: "还没有密码修改申请",
    passwordApproved: "管理员已同意，新密码已经生效",
    passwordPending: "申请仍在等待管理员审核",
    passwordRejected: "最近的密码申请未生效",
    visibilityHint: "好友可见表示登录好友可以查看，对外仍然不可见。",
    privateVisibility: "私密",
    friendsVisibility: "好友可见",
    languageHint: "语言偏好会跟随账号保存，并在核心界面即时生效。",
    chinese: "中文",
    english: "English",
    languageSaved: "语言设置已保存",
  },
  channels: {
    channels: "频道",
    membersCount: (count) => `${count} 位成员`,
    allUsers: "全部用户",
    channelMessagesHint: "世界频道消息可以同步广播到公告栏。",
    invite: "邀请",
    manage: "管理",
    send: "发送",
    sending: "发送中",
    empty: "还没有消息。",
    typeMessage: "输入消息...",
    publishToFeed: "同步广播这条世界频道消息",
    loadFailed: "加载失败",
    createGroup: "创建群组",
    groupInfo: "群聊信息",
    groupName: "群聊名称",
    groupAnnouncement: "群公告",
    groupOwner: "群主",
    groupMembers: "群成员",
    removeMember: "移除成员",
    leaveGroup: "退出群聊",
    dissolveGroup: "解散群聊",
    saveGroup: "保存群资料",
    savedGroup: "群资料已保存",
    removedMember: "已移除群成员",
    leftGroup: "已退出群聊",
    dissolvedGroup: "群聊已解散",
    worldReadonly: "世界频道不提供群管理功能。",
    ownerOnly: "仅群主可编辑群资料和成员。",
    noAnnouncement: "暂未设置群公告",
    manageHiddenForWorld: "世界频道没有群管理页",
    confirmRemove: (name) => `确认将 ${name} 移出群聊吗？`,
    confirmLeave: "确认退出当前群聊吗？",
    confirmDissolve: "确认解散当前群聊吗？此操作不可恢复。",
    notFound: "群聊不存在或你没有访问权限。",
    openGroupInfo: "打开群聊信息",
  },
}

const enUS: Dictionary = {
  common: {
    back: "Back",
    save: "Save",
    saving: "Saving",
    cancel: "Cancel",
    refresh: "Refresh",
    loading: "Loading",
    settings: "Settings",
  },
  nav: {
    home: "Home",
    resume: "Resume",
    blog: "Blog",
    daily: "Daily",
    reflections: "Reflections",
    notes: "Notes",
    jobs: "Jobs",
    interviews: "Interviews",
    ai: "AI",
    friends: "Friends",
    admin: "Admin",
    login: "Login",
    logout: "Log out",
    settings: "Settings",
  },
  settings: {
    title: "Settings",
    description: "Manage your profile, password request, visibility, and language.",
    profile: "Profile",
    profileDesc: "Update display name, avatar, location, bio, and email.",
    password: "Password",
    passwordDesc: "Submit a password change request and check approval status.",
    privacy: "Profile Visibility",
    privacyDesc: "Control which modules are visible to friends.",
    language: "Language",
    languageDesc: "Switch between Chinese and English.",
    profileTitle: "Profile Settings",
    passwordTitle: "Password Change",
    privacyTitle: "Profile Visibility",
    languageTitle: "Language Settings",
    displayName: "Display name",
    avatarText: "Avatar fallback text",
    avatarUpload: "Upload avatar",
    location: "Location",
    bio: "Bio",
    email: "Email",
    profileSaved: "Profile saved",
    profileSaveFailed: "Failed to save profile",
    avatarImageOnly: "Please choose an image file",
    avatarTooLarge: "Avatar image must be under 5MB",
    passwordInput: "Enter a new password",
    passwordSubmit: "Submit request",
    passwordStatus: "Check status",
    passwordRequested: "Password change request submitted and waiting for approval",
    passwordRequestFailed: "Failed to submit password change request",
    passwordNoRequest: "No password change request yet",
    passwordApproved: "Your latest password request was approved",
    passwordPending: "Your latest password request is still pending",
    passwordRejected: "Your latest password request did not take effect",
    visibilityHint: "Friends can view these modules after logging in. They remain private to everyone else.",
    privateVisibility: "Private",
    friendsVisibility: "Friends only",
    languageHint: "Language preference is saved to your account and applies immediately in core screens.",
    chinese: "中文",
    english: "English",
    languageSaved: "Language preference saved",
  },
  channels: {
    channels: "Channels",
    membersCount: (count) => `${count} members`,
    allUsers: "All users",
    channelMessagesHint: "World channel messages can also be broadcast to the announcement bar.",
    invite: "Invite",
    manage: "Manage",
    send: "Send",
    sending: "Sending",
    empty: "No messages yet.",
    typeMessage: "Type a message...",
    publishToFeed: "Broadcast this world-channel message",
    loadFailed: "Failed to load",
    createGroup: "Create group",
    groupInfo: "Group Info",
    groupName: "Group name",
    groupAnnouncement: "Group announcement",
    groupOwner: "Owner",
    groupMembers: "Members",
    removeMember: "Remove member",
    leaveGroup: "Leave group",
    dissolveGroup: "Dissolve group",
    saveGroup: "Save group info",
    savedGroup: "Group info saved",
    removedMember: "Member removed",
    leftGroup: "You left the group",
    dissolvedGroup: "Group dissolved",
    worldReadonly: "The world channel does not support group management.",
    ownerOnly: "Only the group owner can edit group details or members.",
    noAnnouncement: "No group announcement yet",
    manageHiddenForWorld: "World channel has no group management page",
    confirmRemove: (name) => `Remove ${name} from this group?`,
    confirmLeave: "Leave this group?",
    confirmDissolve: "Dissolve this group? This cannot be undone.",
    notFound: "Group not found or access denied.",
    openGroupInfo: "Open group info",
  },
}

const dictionaries: Record<AppLocale, Dictionary> = {
  "zh-CN": zhCN,
  "en-US": enUS,
}

export function getDictionary(locale: string): Dictionary {
  return dictionaries[isAppLocale(locale) ? locale : "zh-CN"]
}
