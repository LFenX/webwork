export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

/** Safe to call from client components — reads locale from <html lang>. Memoize in a useMemo for React. */
export function getDict(): Dictionary {
  if (typeof document === "undefined") return zhCN
  return getDictionary(document.documentElement.lang)
}

export { type Dictionary }

// ── Type ──────────────────────────────────────────────────────────────────

type Dictionary = {
  common: {
    back: string
    save: string
    saving: string
    cancel: string
    refresh: string
    loading: string
    settings: string
    edit: string
    delete: string
    preview: string
    publish: string
    close: string
    confirm: string
    search: string
    filter: string
    all: string
    none: string
    noData: string
    loadMore: string
    upload: string
    uploading: string
    download: string
    copy: string
    copied: string
    retry: string
    error: string
    ok: string
    version: string
    show: string
    hide: string
    print: string
  }
  nav: {
    home: string
    community: string
    resume: string
    blog: string
    daily: string
    reflections: string
    notes: string
    jobs: string
    interviews: string
    ai: string
    sql: string
    sqlPractice: string
    friends: string
    admin: string
    login: string
    logout: string
    settings: string
    updates: string
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
    usage: string
    usageDesc: string
    profileTitle: string
    passwordTitle: string
    privacyTitle: string
    languageTitle: string
    usageTitle: string
    displayName: string
    avatarText: string
    avatarUpload: string
    location: string
    bio: string
    email: string
    publicSlug: string
    publicSlugHint: string
    copyPublicLink: string
    publicLinkCopied: string
    publicLinkCopyFailed: string
    profileSaved: string
    profileSaveFailed: string
    avatarImageOnly: string
    avatarTooLarge: string
    passwordInput: string
    passwordConfirm: string
    passwordSubmit: string
    passwordStatus: string
    passwordRequested: string
    passwordRequestFailed: string
    passwordNoRequest: string
    passwordApproved: string
    passwordPending: string
    passwordRejected: string
    passwordMismatch: string
    showPassword: string
    hidePassword: string
    visibilityHint: string
    privateVisibility: string
    friendsVisibility: string
    publicVisibility: string
    languageHint: string
    chinese: string
    english: string
    languageSaved: string
    profilePageDesc: string
    nickname: string
    signature: string
    changePassword: string
    currentVersion: string
    uploadNewVersion: string
    versionName: string
    selectPdf: string
    uploadCreatesNewVersion: string
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
    hide: string
    history: string
    loadEarlier: string
    loadFailedMessages: string
  }
  admin: {
    title: string
    description: string
    pendingApprovals: string
    loadedUsers: string
    admins: string
    loading: string
    adminPermissions: string
    transferOwnership: string
    transferOwnerDesc: string
    selectNewOwner: string
    transferOwner: string
    transferredOwner: string
    chooseAdminEdit: string
    noExtraAdmins: string
    permissionsEnabled: (n: number) => string
    close: string
    registrationApprovals: string
    noRegistrationRequests: string
    approve: string
    approved: string
    passwordApprovals: string
    noPasswordRequests: string
    announcements: string
    announcementPlaceholder: string
    publishing: string
    publishAnnouncement: string
    noAnnouncements: string
    worldChannel: string
    adminSource: string
    deleteAnnouncement: string
    worldBroadcasts: string
    noBroadcasts: string
    deleteBroadcast: string
    manageStickers: string
    uploadPublicStickers: string
    stickerDeleted: string
    deleteSticker: string
    userManagement: string
    userTable: { displayName: string; role: string; lastLogin: string; deleteRule: string; actions: string }
    role: { user: string; admin: string; owner: string }
    deleteBlocked: { self: string; owner: string; neverLogin: string; daysRemaining: (n: number) => string }
    deletable: string
    deleteUser: string
    transfer: string
    loadingMoreUsers: string
    recentActivity: string
    lastRefresh: string
    notRefreshedYet: string
    refreshLogs: string
    refreshing: string
    refreshGeo: string
    noActivity: string
    activityTable: { time: string; action: string; userDetail: string; ipAddress: string; geo: string; device: string }
    system: string
    unknown: string
    loadingMoreActivity: string
    changelogDisplay: string
    noUpdateRecords: string
    originalNote: string
    status: {
      hidden: string
      showingOriginalNote: string
      showingCustomNote: string
    }
    saveCustomNote: string
    restoreOriginal: string
    hideEntry: string
    failedToLoad: string
    roleUpdated: string
    ownershipTransferred: string
    announcementPublished: string
    announcementDeleted: string
    broadcastDeleted: string
    stickersUploaded: string
    stickerDeleteFailed: string
    userDeleted: string
    updateLogSaved: string
    originalRestored: string
    updateHidden: string
    geoRefreshed: (updated: number, failed: number) => string
    permissionsUpdated: string
    neverLoggedIn: string
    loadingFailed: string
    aiPanel: {
      title: string
      refresh: string
      refreshing: string
      newGrant: string
      pendingRequests: string
      activeGrants: string
      registeredTools: string
      accessRequests: string
      noRequests: string
      reviewNote: string
      review: string
      configureGrant: string
      systemGrants: string
      noGrants: string
      configGrant: string
      targetAdmin: string
      targetUser: string
      selectOne: string
      searchUserPlaceholder: string
      noUsersAvailable: string
      noMatchingUsers: string
      configGrantDesc: string
      providerLabel: string
      baseUrl: string
      apiKey: string
      model: string
      temperature: string
      saveGrant: string
      cancel: string
      pause: string
      revoke: string
      recentAudit: string
      noAudit: string
      registeredToolsTitle: string
      reviewRequest: string
      reviewRequestDesc: string
      optionalNote: string
      reject: string
      approve: string
      updated: string
      failed: string
      grantSaved: string
      grantPaused: string
      grantRevoked: string
      requestApproved: string
      requestRejected: string
      restore: string
      deleteGrant: string
      deleteGrantConfirm: string
      grantDeleted: string
      grantRestored: string
      grantDeprecated: string
      modelListLabel: string
      modelListHint: string
      statusActive: string
      statusPaused: string
      statusRevoked: string
      statusDeprecated: string
      statusConfigured: string
      statusCancelled: string
      statusApproved: string
      statusRejected: string
      awaitingConfig: string
      configured: string
      editGrantTitle: string
      editGrantDesc: string
      saveEdit: string
      savedEdit: string
      apiKeyEditPlaceholder: string
      grantUserInfo: string
      grantStatusLabel: string
    }
  }
  auth: {
    email: string
    password: string
    passwordPlaceholder: string
    showPassword: string
    hidePassword: string
    login: string
    loggingIn: string
    resetPassword: string
    registerEmail: string
    newPasswordMin: string
    newPasswordPlaceholder: string
    submitting: string
    submitRequest: string
    checking: string
    checkStatus: string
    networkError: string
    loginFailed: string
    nickname: string
    namePlaceholder: string
    passwordMin: string
    submitRegistration: string
    checkApproval: string
    goToLogin: string
    registrationSubmitted: string
    registrationFailed: string
    passwordChangeSubmitted: string
    noRequest: string
    approved: string
    pending: string
    rejected: string
    requestFailed: string
    checkFailed: string
    noEmail: string
  }
  article: {
    backTo: (label: string) => string
    publishedAt: string
    updatedAt: string
    author: string
    uncategorized: string
    wordCount: string
    readingTime: string
    minutes: string
    toc: string
    noHeadings: string
    edit: string
    share: string
    shareCopied: string
    shareCopyFailed: string
    shareNeedsPublic: string
    new: string
    count: (n: number) => string
    empty: (label: string) => string
    deleteConfirm: (title: string) => string
    deleteSuccess: string
    deleteFailed: string
    visibilityLabel: string
    visibilityPrivate: string
    visibilityFriends: string
    visibilityPublic: string
    visibilityUpdated: string
    visibilityFailed: string
    folder: string
    moveToFolder: string
    movedToFolder: string
    movedToUncategorized: string
    moveFailed: string
  }
  editor: {
    backToList: (label: string) => string
    backToView: string
    preview: string
    delete: string
    publish: string
    save: string
    saving: string
    title: string
    titlePlaceholder: string
    summary: string
    summaryPlaceholder: string
    date: string
    tags: string
    tagsPlaceholder: string
    visibility: string
    visibilityHint: string
    folder: string
    folderUncategorized: string
    content: string
    contentPlaceholder: string
    deleteConfirm: (title: string) => string
    deleteCancelled: string
    published: string
    publishedAndRedirect: string
    saved: string
    draftLoaded: string
    loadEditor: string
    startWriting: string
    confirmEditShortcut: string
    editLatex: string
    insertColumnLeft: string
    insertColumnRight: string
    insertRowAbove: string
    insertRowBelow: string
    deleteColumn: string
    deleteRow: string
    mergeCells: string
    splitCell: string
    deleteTable: string
    toggleHeader: string
    headerRow: string
    tableStyle: string
    enterMarkdown: string
  }
  home: {
    heroTitle: string
    heroSubtitle: string
    noUpdates: string
    backToHome: string
    editLayout: string
    saveLayout: string
    restoreLayout: string
    layoutSaved: string
    layoutRestored: string
    visitStats: string
    heatmapTitle: string
    moduleViews: string
    noVisits: string
    recentVisits: string
    noDetails: string
    anonymous: string
    visitor: string
    channel: string
    announcement: string
    announcements: string
    latestArticles: string
    jobStats: string
    total: string
    replied: string
    interviews: string
    offers: string
    replyRate: string
  }
  ai: {
    title: string
    manageAuth: string
    send: string
    thinking: string
    streaming: string
    toolCalling: string
    imageUnderstanding: string
    thinkingStream: string
    clearChat: string
    chatHistory: string
    newConversation: string
    typeMessage: string
    emptyState: string
    error: string
    retry: string
    settings: string
    providerLabel: string
    baseUrl: string
    apiKey: string
    model: string
    temperature: string
    streamEnabled: string
    saveSettings: string
    settingsSaved: string
    requestAccess: string
    accessRequested: string
    requestingAccess: string
    accessPending: string
    accessDenied: string
    noGrants: string
    grantPaused: string
    grantRevoked: string
    newChat: string
    conversations: string
    sidebarAssistantSubtitle: string
    conversationToday: string
    conversationRecent7Days: string
    conversationEarlier: string
    soulwingSettings: string
    personalVersion: string
    more: string
    advanced: string
    generating: string
    sendMessage: string
    configureApi: string
    openAiSettings: string
    loadingAi: string
    switchConversation: string
    chatSettings: string
    currentSource: string
    noModelSelected: string
    removeImage: string
    uploadImage: string
    clickToSend: string
    startNewConversation: string
    inspirationSuggestions: string
    suggestionGeneratedHint: string
    suggestionFallbackHint: string
    suggestionsUpdating: string
    suggestionsCount: (count: number) => string
    featuredSuggestion: string
    moreSuggestion: string
    showMoreInspirations: string
    hideMoreInspirations: string
    moreInspirationBubble: string
    emptyGreeting: (name: string) => string
    notProvided: string
    answerCopied: string
    applicationStatus: string
    reviewNote: string
    requestPlaceholder: string
    pleaseTryLater: string
    currentlyUnavailable: string
    sourceCustom: string
    sourceGrant: string
    sourceNone: string
    modeAdminDelegated: string
    modeVisibleUser: string
    modeSelf: string
    stepKindFinalAnswer: string
    stepKindWarning: string
    stepKindGeneric: string
    stepKindPhase: string
    phaseCount: (count: number) => string
    messagesCount: (count: number) => string
    thinkingStages: (count: number) => string
    noExplicitThinking: string
    toolCallsTimes: (count: number) => string
    noToolCalls: string
    traceExecutionTitle: string
    traceExecutionHint: string
    traceKeySignal: string
    traceNextStep: string
    traceInput: string
    traceResult: string
    tracePayload: string
    traceRunning: string
    traceToolRunning: string
    traceNoExplicitThinking: string
    traceStatusFailed: string
    traceStatusRunning: string
    traceStatusCompleted: string
    traceStatusCancelled: string
    runStoppedNote: string
    runReleasedBackground: string
    taskPanelRunningTitle: string
    taskPanelJump: string
    taskPanelStop: string
    taskPanelPhase: string
    taskPanelSections: string
    taskPanelTools: string
    taskPanelDuration: string
    taskPanelPhaseWriting: string
    taskPanelPhaseCompiling: string
    taskPanelPhaseThinking: string
    traceKeyJudgement: (count: number) => string
    tracePendingConfirm: (count: number) => string
    traceEvidence: string
    traceApproxDuration: (seconds: number) => string
    traceToolProgress: string
    traceQueued: string
    traceCompletedSummary: string
    viewExecution: string
    executionHint: string
    thinkingProcess: string
    toolCallProcess: string
    generatingMessage: string
    stepWhatDoing: string
    stepSupplementalData: string
    stepInputInfo: string
    stepWhatGot: string
    stepWhyResult: string
    stepDataSummary: string
    stepWhatReturned: string
    stepWhyFailed: string
    stepFallbackNote: string
    heroTitle: string
    heroDescription: string
    codexViewTitle: string
    codexViewDescription: string
    desktopPlaceholder: string
    mobilePlaceholder: string
    mobileConversationsHint: string
    loadAiStatusFailed: string
    loadConversationsFailed: string
    loadMessagesFailed: string
    loadAiFailed: string
    createConversationFailed: string
    renameConversationFailed: string
    deleteConversationFailed: string
    submitRequestFailed: string
    aiRequestSubmitted: string
    imageUploadFailed: string
    sendFailed: string
    generateFailedRetry: string
    noAvailableAiHint: string
    saveConfigFailed: string
    configSaved: string
    testConnectionFailed: string
    testConnectionSuccess: string
    deleteConfigFailed: string
    configDeleted: string
    settingsSheetTitle: string
    settingsSheetDescription: string
    storageNotReadyWarning: string
    currentMask: string
    notConfigured: string
    lastTest: string
    apiKeyPlaceholder: string
    modelPlaceholder: string
    modelListLabel: string
    modelListPlaceholder: string
    modelListHint: string
    streamEnabledHint: string
    enableConfigLabel: string
    enableConfigHint: string
    testingConnection: string
    testConnectionBtn: string
    savingConfig: string
    saveConfigBtn: string
    deleteConfigBtn: string
    capabilityDescriptionTitle: string
    capabilityDescriptionHint: string
    configName: string
    configNamePlaceholder: string
    savedConfigs: string
    activeConfig: string
    noSavedConfigs: string
    loadConfig: string
    newConfig: string
    activateConfig: string
    configActivated: string
    deleteConfigConfirm: string
    confirmDeleteConfig: string
    loadConfigPrompt: string
    loadingConfigs: string
    activeBadge: string
    notActive: string
    stepSystemCalled: string
    stepPurposeIs: string
    reasonReady: string
    reasonServerSecretMissing: string
    reasonConfigurePersonalApi: string
    reasonRequestAccess: string
    reasonUnavailable: string
    adminGrantRequest: string
    adminGrantDesc: string
    applyForGrant: string
    cancelRequest: string
    cancelRequestConfirm: string
    requestCancelled: string
    adminGrantConfigured: string
    adminGrantActive: string
    adminGrantPausedHint: string
    adminGrantRevokedHint: string
    sourceSelf: string
    sourceAdminGrant: string
    requestStatusPending: string
    requestStatusApproved: string
    requestStatusRejected: string
    requestStatusCancelled: string
    requestStatusConfigured: string
    grantStatusActive: string
    grantStatusPaused: string
    grantStatusRevoked: string
    grantStatusDeprecated: string
    activateFailed: string
  }
  comments: {
    title: string
    loading: string
    noComments: string
    placeholder: string
    sending: string
    post: string
    hideReplies: (n: number) => string
    showReplies: (n: number) => string
    reply: string
    delete: string
    replyTo: string
    sendingReply: string
    sendReply: string
    deleted: string
  }
  guestbook: {
    title: string
    placeholder: string
    sending: string
    submit: string
    noMessages: string
    justNow: string
    minutesAgo: (n: number) => string
    hoursAgo: (n: number) => string
    daysAgo: (n: number) => string
  }
  stickers: {
    defaultTab: string
    customTab: string
    publicTab: string
    communityStickers: string
    addToCustom: string
    savedToCustom: string
    contributeToCommunity: string
    contributed: string
    createGroup: string
    renameGroup: string
    deleteGroup: string
    addToGroup: string
    removeFromGroup: string
    groupName: string
    manageGroups: string
    close: string
    back: string
  }
  images: {
    title: string
    used: string
    loading: string
    noImages: string
    copyMarkdown: string
    copiedMarkdown: string
    delete: string
    insertIntoEditor: string
    copyLink: string
    download: string
    confirmDelete: (name: string) => string
    deleted: string
    deleteFailed: string
  }
  jobs: {
    title: string
    description: string
    total: string
    replied: string
    interviewRate: string
    offerRate: string
    replyRate: string
    statusChart: string
    channelChart: string
    trendChart: string
    search: string
    allStatus: string
    newApplication: string
    editApplication: string
    detail: string
    company: string
    position: string
    channel: string
    appliedAt: string
    status: string
    notes: string
    baseLocation: string
    hrContact: string
    link: string
    save: string
    saving: string
    cancel: string
    delete: string
    noData: string
    deleteConfirm: (company: string) => string
    deleted: string
    saved: string
    deleteFailed: string
  }
  interviews: {
    title: string
    description: string
    total: string
    passed: string
    failed: string
    pending: string
    passRate: string
    roundChart: string
    formatChart: string
    companyChart: string
    newInterview: string
    editInterview: string
    company: string
    position: string
    round: string
    format: string
    scheduledAt: string
    interviewers: string
    questions: string
    selfRating: string
    result: string
    feedback: string
    detail: string
    linkJob: string
    noJob: string
    save: string
    saving: string
    cancel: string
    delete: string
    noData: string
    deleteConfirm: (company: string) => string
    deleted: string
    saved: string
    deleteFailed: string
  }
  resume: {
    title: string
    edit: string
    editHint: string
    back: string
    preview: string
    saving: string
    save: string
    pdfMode: string
    contentLabel: string
    previewLabel: string
    currentVersion: string
    noPdf: string
    uploadNew: string
    versionPlaceholder: string
    selectPdf: string
    uploading: string
    uploadCreatesVersion: string
    versions: string
    noVersions: string
    currentDisplay: string
    setDisplay: string
    downloadVersion: string
    deleteVersion: string
    deleteVersionConfirm: (name: string) => string
    saved: string
    saveFailed: string
    uploaded: string
    uploadFailed: string
    versionDeleted: string
    displayUpdated: string
    displayUpdateFailed: string
    templates: string
    themeLabel: string
    themeFallback: string
    noThemes: string
    renderFailed: string
    goTemplates: string
    markdownBanner: string
    switchToOnline: string
    exportPdfSoon: string
    onlineResume: string
    pdfResume: string
    oldMarkdownLabel: string
  }
  friends: {
    search: string
    noFriends: string
    online: string
    away: string
    offline: string
    addFriend: string
    friendRequests: string
    accept: string
    reject: string
    moduleLabels: Record<string, string>
  }
  notifications: {
    newMessage: string
    sticker: string
    image: string
    attachment: string
    from: string
    open: string
    sessionExpired: string
    sessionExpiredDesc: string
    reLogin: string
  }
  error: {
    title: string
    description: string
    refreshPage: string
    showDetails: string
  }
  updates: {
    title: string
    backToHome: string
    noUpdates: string
  }
}

// ── Chinese ────────────────────────────────────────────────────────────────

const zhCN: Dictionary = {
  common: {
    back: "返回",
    save: "保存",
    saving: "保存中",
    cancel: "取消",
    refresh: "刷新",
    loading: "加载中",
    settings: "设置",
    edit: "编辑",
    delete: "删除",
    preview: "预览",
    publish: "发布",
    close: "关闭",
    confirm: "确认",
    search: "搜索",
    filter: "筛选",
    all: "全部",
    none: "无",
    noData: "暂无数据",
    loadMore: "加载更多",
    upload: "上传",
    uploading: "上传中",
    download: "下载",
    copy: "复制",
    copied: "已复制",
    retry: "重试",
    error: "错误",
    ok: "确定",
    version: "版本",
    show: "显示",
    hide: "隐藏",
    print: "打印 / 导出 PDF",
  },
  nav: {
    home: "首页",
    community: "社区",
    resume: "简历",
    blog: "博客",
    daily: "日常",
    reflections: "心得",
    notes: "笔记",
    jobs: "求职",
    interviews: "面试",
    ai: "蝶灵",
    sql: "SQL 实验室",
    sqlPractice: "SQL 练题",
    friends: "好友",
    admin: "管理",
    login: "登录",
    logout: "退出登录",
    settings: "设置",
    updates: "更新日志",
  },
  settings: {
    title: "设置中心",
    description: "管理个人资料、密码申请、隐私和语言偏好。",
    profile: "个人资料",
    profileDesc: "修改昵称、头像、地区、简介和邮箱。",
    password: "修改密码",
    passwordDesc: "提交密码修改申请并查看审批状态。",
    privacy: "资料可见范围",
    privacyDesc: "统一管理各模块是否对好友可见。",
    language: "语言",
    languageDesc: "切换中文和英文界面。",
    usage: "使用说明",
    usageDesc: "了解网站的核心功能、内容创作、求职管理、社交互动、社区资源和 AI 助手的使用方式。",
    profileTitle: "个人资料设置",
    passwordTitle: "密码修改",
    privacyTitle: "资料可见范围",
    languageTitle: "语言设置",
    usageTitle: "使用说明",
    displayName: "昵称",
    avatarText: "默认头像文字",
    avatarUpload: "上传头像",
    location: "地区",
    bio: "简介",
    email: "邮箱",
    publicSlug: "公开主页地址",
    publicSlugHint: "可选。仅支持小写字母、数字和短横线，保存后公开链接会优先使用它。",
    copyPublicLink: "复制公开主页链接",
    publicLinkCopied: "公开主页链接已复制",
    publicLinkCopyFailed: "复制失败，请手动复制",
    profileSaved: "个人资料已保存",
    profileSaveFailed: "保存个人资料失败",
    avatarImageOnly: "请选择图片文件",
    avatarTooLarge: "头像图片不能超过 5MB",
    passwordInput: "输入新密码",
    passwordConfirm: "再次输入新密码",
    passwordSubmit: "提交申请",
    passwordStatus: "查看状态",
    passwordRequested: "密码修改申请已提交，等待管理员审批。",
    passwordRequestFailed: "提交密码修改申请失败",
    passwordNoRequest: "还没有密码修改申请。",
    passwordApproved: "最近一次密码修改申请已通过。",
    passwordPending: "最近一次密码修改申请仍在等待审批。",
    passwordRejected: "最近一次密码修改申请未生效。",
    passwordMismatch: "两次输入的新密码不一致。",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    visibilityHint: "模块可见性和文章可见性是双层控制：模块公开不等于文章公开，文章公开也不会绕过模块权限。",
    privateVisibility: "仅自己",
    friendsVisibility: "好友可见",
    publicVisibility: "公开",
    languageHint: "语言偏好会保存到账号，并立即应用到主要界面。",
    chinese: "中文",
    english: "English",
    languageSaved: "语言设置已保存",
    profilePageDesc: "昵称和头像将在站点标题、好友列表、聊天消息和评论中展示。",
    nickname: "昵称",
    signature: "个性签名",
    changePassword: "修改密码",
    currentVersion: "当前简历版本",
    uploadNewVersion: "上传新版本",
    versionName: "版本名...",
    selectPdf: "选择 PDF 文件",
    uploadCreatesNewVersion: "上传会创建一个新版本，不会影响当前版本。",
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
    ownerOnly: "只有群主可以修改群资料和成员。",
    noAnnouncement: "暂未设置群公告",
    manageHiddenForWorld: "世界频道没有群管理页面",
    confirmRemove: (name) => `确认将 ${name} 移出群聊吗？`,
    confirmLeave: "确认退出当前群聊吗？",
    confirmDissolve: "确认解散当前群聊吗？此操作不可恢复。",
    notFound: "群聊不存在或你没有访问权限。",
    openGroupInfo: "打开群聊信息",
    hide: "隐藏",
    history: "历史",
    loadEarlier: "加载更早消息",
    loadFailedMessages: "加载失败",
  },
  admin: {
    title: "管理员控制台",
    description: "审核访问请求，管理成员，查看近期操作记录。",
    pendingApprovals: "待审批",
    loadedUsers: "已加载用户",
    admins: "管理员",
    loading: "加载中...",
    adminPermissions: "管理员权限",
    transferOwnership: "转让所有权",
    transferOwnerDesc: "选择另一位管理员或成员成为站点所有者。转让后你仍保留管理员权限。",
    selectNewOwner: "选择新所有者",
    transferOwner: "转让所有权",
    transferredOwner: "所有权已转让",
    chooseAdminEdit: "选择一位管理员来编辑权限",
    noExtraAdmins: "暂无其他管理员。",
    permissionsEnabled: (n) => `已启用 ${n} 项权限`,
    close: "关闭",
    registrationApprovals: "注册审批",
    noRegistrationRequests: "暂无待审批的注册申请。",
    approve: "通过",
    approved: "注册已通过",
    passwordApprovals: "密码修改审批",
    noPasswordRequests: "暂无待审批的密码修改申请。",
    announcements: "公告管理",
    announcementPlaceholder: "输入要在首页展示的公告内容。",
    publishing: "发布中...",
    publishAnnouncement: "发布公告",
    noAnnouncements: "暂无公告记录。",
    worldChannel: "世界频道",
    adminSource: "管理员",
    deleteAnnouncement: "删除此公告",
    worldBroadcasts: "世界频道广播",
    noBroadcasts: "暂无广播记录。",
    deleteBroadcast: "删除此广播",
    manageStickers: "公共表情库",
    uploadPublicStickers: "上传公共表情",
    stickerDeleted: "表情已删除",
    deleteSticker: "删除表情",
    userManagement: "用户管理",
    userTable: {
      displayName: "用户",
      role: "角色",
      lastLogin: "最近登录",
      deleteRule: "删除条件",
      actions: "",
    },
    role: {
      user: "用户",
      admin: "管理员",
      owner: "所有者",
    },
    deleteBlocked: {
      self: "不能删除自己",
      owner: "不能删除所有者",
      neverLogin: "从未登录",
      daysRemaining: (n) => `还需 ${n} 天`,
    },
    deletable: "可删除",
    deleteUser: "删除用户",
    transfer: "转让",
    loadingMoreUsers: "加载更多用户...",
    recentActivity: "近期活动",
    lastRefresh: "上次刷新",
    notRefreshedYet: "尚未刷新",
    refreshLogs: "刷新日志",
    refreshing: "刷新中...",
    refreshGeo: "刷新地理数据",
    noActivity: "暂无活动记录。",
    activityTable: {
      time: "时间",
      action: "操作",
      userDetail: "用户及详情",
      ipAddress: "IP 地址",
      geo: "地理位置",
      device: "设备",
    },
    system: "系统",
    unknown: "未知",
    loadingMoreActivity: "加载更多活动...",
    changelogDisplay: "公开更新日志展示",
    noUpdateRecords: "暂无 git 更新记录。",
    originalNote: "原始记录",
    status: {
      hidden: "已隐藏",
      showingOriginalNote: "展示原始记录",
      showingCustomNote: "展示自定义记录",
    },
    saveCustomNote: "保存自定义说明",
    restoreOriginal: "恢复原始内容",
    hideEntry: "隐藏条目",
    failedToLoad: "加载管理员面板失败",
    roleUpdated: "用户角色已更新",
    ownershipTransferred: "所有权已转让",
    announcementPublished: "公告已发布",
    announcementDeleted: "公告已删除",
    broadcastDeleted: "广播已删除",
    stickersUploaded: "公共表情已上传",
    stickerDeleteFailed: "表情删除失败",
    userDeleted: "用户已删除",
    updateLogSaved: "更新日志展示已保存",
    originalRestored: "已恢复原始提交说明",
    updateHidden: "更新已从更新日志中隐藏",
    geoRefreshed: (updated, failed) => `地理位置已更新 ${updated} 条，${failed} 条失败`,
    permissionsUpdated: "管理员权限已更新",
    neverLoggedIn: "从未登录",
    loadingFailed: "加载失败",
    aiPanel: {
      title: "AI 助手",
      refresh: "刷新",
      refreshing: "刷新中...",
      newGrant: "新建授权",
      pendingRequests: "待处理请求",
      activeGrants: "活跃授权",
      registeredTools: "已注册工具",
      accessRequests: "访问请求",
      noRequests: "暂无 AI 访问请求。",
      reviewNote: "审核备注",
      review: "审核",
      configureGrant: "配置授权",
      systemGrants: "系统授权",
      noGrants: "暂无系统授权。",
      configGrant: "配置 AI 授权",
      targetAdmin: "目标管理员",
      targetUser: "授权对象",
      selectOne: "请选择",
      searchUserPlaceholder: "搜索或选择用户...",
      noUsersAvailable: "暂无可授权用户",
      noMatchingUsers: "没有匹配用户",
      configGrantDesc: "选择要获得该 AI 配置授权的用户。保存后，该用户可在自己的 AI 助手配置中选择并使用此模型；你仍可在管理员后台暂停、恢复或弃用该授权。",
      providerLabel: "提供商标签",
      baseUrl: "Base URL",
      apiKey: "API Key",
      model: "Model",
      temperature: "Temperature",
      saveGrant: "保存授权",
      cancel: "取消",
      pause: "暂停",
      revoke: "撤销",
      recentAudit: "近期审计操作",
      noAudit: "暂无审计记录。",
      registeredToolsTitle: "已注册工具",
      reviewRequest: "审核 AI 访问请求",
      reviewRequestDesc: "通过请求不会取消用户使用个人提供商密钥的选项。",
      optionalNote: "可选审核备注",
      reject: "拒绝",
      approve: "通过",
      updated: "更新时间",
      failed: "加载失败",
      grantSaved: "AI 授权已保存",
      grantPaused: "授权已暂停",
      grantRevoked: "授权已撤销",
      requestApproved: "AI 请求已通过",
      requestRejected: "AI 请求已拒绝",
      restore: "恢复",
      deleteGrant: "删除记录",
      deleteGrantConfirm: "确认删除此授权记录？删除后用户将无法使用此授权。",
      grantDeleted: "授权记录已删除",
      grantRestored: "授权已恢复",
      grantDeprecated: "授权已弃用",
      modelListLabel: "模型列表",
      modelListHint: "每行一个模型名称。用户只能在列表范围内切换模型。",
      statusActive: "活跃",
      statusPaused: "已暂停",
      statusRevoked: "已弃用",
      statusDeprecated: "已弃用",
      statusConfigured: "已配置",
      statusCancelled: "已撤回",
      statusApproved: "已通过",
      statusRejected: "已拒绝",
      awaitingConfig: "待配置授权",
      configured: "已配置",
      editGrantTitle: "编辑 AI 授权",
      editGrantDesc: "修改该用户的 AI 模型授权配置。API Key 留空则不修改原有密钥。",
      saveEdit: "保存修改",
      savedEdit: "AI 授权已更新",
      apiKeyEditPlaceholder: "留空则不修改原有密钥",
      grantUserInfo: "授权用户",
      grantStatusLabel: "授权状态",
    },
  },
  auth: {
    email: "邮箱",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    login: "登录",
    loggingIn: "登录中...",
    resetPassword: "修改或找回密码",
    registerEmail: "注册邮箱",
    newPasswordMin: "新密码（至少 8 位）",
    newPasswordPlaceholder: "输入希望设置的新密码",
    submitting: "提交中...",
    submitRequest: "提交申请",
    checking: "查询中...",
    checkStatus: "查看是否生效",
    networkError: "网络错误，请稍后再试",
    loginFailed: "登录失败，请稍后再试",
    nickname: "昵称",
    namePlaceholder: "你的名字",
    passwordMin: "密码（至少 8 位）",
    submitRegistration: "提交注册申请",
    checkApproval: "查看审核状态",
    goToLogin: "去登录",
    registrationSubmitted: "注册申请已提交，等待管理员审核。",
    registrationFailed: "注册失败，请稍后再试",
    passwordChangeSubmitted: "密码修改申请已提交，等待管理员同意",
    noRequest: "还没有找到这个邮箱的密码修改申请",
    approved: "管理员已同意，新密码已经生效，可以直接登录",
    pending: "申请仍在等待管理员审核",
    rejected: "最近的密码申请未生效",
    requestFailed: "提交失败",
    checkFailed: "查询失败",
    noEmail: "请输入注册邮箱后再查看审核状态",
  },
  article: {
    backTo: (label) => `返回${label}`,
    publishedAt: "发布于",
    updatedAt: "更新于",
    author: "作者",
    uncategorized: "未分类",
    wordCount: "总字数",
    readingTime: "阅读时长",
    minutes: "分钟",
    toc: "目录",
    noHeadings: "暂无标题",
    edit: "编辑",
    share: "分享",
    shareCopied: "文章链接已复制",
    shareCopyFailed: "复制失败，请手动复制",
    shareNeedsPublic: "请先把文章和所属模块都设为公开，再复制分享链接。",
    new: "新建",
    count: (n) => `${n} 篇`,
    empty: (label) => `还没有${label}，点击右上角新建。`,
    deleteConfirm: (title) => `确认删除《${title}》吗？此操作不可恢复。`,
    deleteSuccess: "文章已删除",
    deleteFailed: "删除文章失败",
    visibilityLabel: "文章可见性",
    visibilityPrivate: "私密",
    visibilityFriends: "好友可见",
    visibilityPublic: "公开",
    visibilityUpdated: "权限已更新",
    visibilityFailed: "权限更新失败",
    folder: "文件夹",
    moveToFolder: "已加入文件夹",
    movedToFolder: "已移到未分类",
    movedToUncategorized: "移动文件夹失败",
    moveFailed: "移动文件夹失败",
  },
  editor: {
    backToList: (label) => `返回${label}列表`,
    backToView: "返回查看模式",
    preview: "预览",
    delete: "删除",
    publish: "发布",
    save: "保存",
    saving: "保存中...",
    title: "标题",
    titlePlaceholder: "输入标题...",
    summary: "摘要",
    summaryPlaceholder: "简短描述，用于列表展示...",
    date: "日期",
    tags: "标签（逗号分隔）",
    tagsPlaceholder: "标签",
    visibility: "可见性",
    visibilityHint: "好友可见表示登录好友可以查看，对外部访客不可见。",
    folder: "所属文件夹",
    folderUncategorized: "未分类",
    content: "正文",
    contentPlaceholder: "开始写作...",
    deleteConfirm: (title) => `确认删除《${title}》吗？此操作不可恢复。`,
    deleteCancelled: "已取消删除",
    published: "文章已发布",
    publishedAndRedirect: "已发布，正在跳转...",
    saved: "已保存",
    draftLoaded: "已加载上次保存的草稿",
    loadEditor: "加载编辑器...",
    startWriting: "开始写作...",
    confirmEditShortcut: "按 Enter 或 Escape 确认",
    editLatex: "编辑 LaTeX 公式...",
    insertColumnLeft: "在左侧插入列",
    insertColumnRight: "在右侧插入列",
    insertRowAbove: "在上方插入行",
    insertRowBelow: "在下方插入行",
    deleteColumn: "删列",
    deleteRow: "删行",
    mergeCells: "合并单元格",
    splitCell: "拆分单元格",
    deleteTable: "删除整个表格",
    toggleHeader: "切换表头",
    headerRow: "表头",
    tableStyle: "表格样式",
    enterMarkdown: "在此输入 Markdown...",
  },
  home: {
    heroTitle: "首页",
    heroSubtitle: "",
    noUpdates: "暂无可展示的更新记录。",
    backToHome: "返回首页",
    editLayout: "编辑布局",
    saveLayout: "保存布局",
    restoreLayout: "恢复默认",
    layoutSaved: "布局已保存",
    layoutRestored: "布局已恢复默认",
    visitStats: "访问统计",
    heatmapTitle: "最近 26 周访问热力图",
    moduleViews: "各模块浏览明细次数",
    noVisits: "暂无访问记录",
    recentVisits: "最近访问",
    noDetails: "暂无明细",
    anonymous: "匿名访客",
    visitor: "访客",
    channel: "频道",
    announcement: "公告",
    announcements: "公告",
    latestArticles: "最新文章",
    jobStats: "求职统计",
    total: "总数",
    replied: "有回复",
    interviews: "面试",
    offers: "Offer",
    replyRate: "回复率",
  },
  ai: {
    title: "蝶灵",
    manageAuth: "管理 AI 授权",
    send: "发送",
    thinking: "思考中",
    streaming: "流式",
    toolCalling: "工具调用",
    imageUnderstanding: "图片理解",
    thinkingStream: "思考流",
    clearChat: "清空对话",
    chatHistory: "对话历史",
    newConversation: "新建对话",
    typeMessage: "输入消息...",
    emptyState: "开始一段新的对话吧。",
    error: "请求失败",
    retry: "重试",
    settings: "设置",
    providerLabel: "提供商标签",
    baseUrl: "Base URL",
    apiKey: "API Key",
    model: "Model",
    temperature: "Temperature",
    streamEnabled: "启用流式输出",
    saveSettings: "保存设置",
    settingsSaved: "设置已保存",
    requestAccess: "申请访问权限",
    accessRequested: "访问权限申请已提交",
    requestingAccess: "申请中...",
    accessPending: "你的 AI 访问权限申请正在等待管理员审批。",
    accessDenied: "你没有 AI 访问权限，请先申请或使用个人 API key。",
    noGrants: "暂无可用授权",
    grantPaused: "授权已暂停",
    grantRevoked: "授权已撤销",
    newChat: "新建",
    conversations: "会话",
    sidebarAssistantSubtitle: "AI 助手",
    conversationToday: "今天",
    conversationRecent7Days: "最近 7 天",
    conversationEarlier: "更早",
    soulwingSettings: "蝶灵设置",
    personalVersion: "个人版",
    more: "更多",
    advanced: "进阶",
    generating: "生成中",
    sendMessage: "发送消息",
    configureApi: "配置 API",
    openAiSettings: "打开 AI 设置",
    loadingAi: "正在加载蝶灵...",
    switchConversation: "切换会话",
    chatSettings: "聊天设置",
    currentSource: "当前来源",
    noModelSelected: "未选择模型",
    removeImage: "移除图片",
    uploadImage: "上传图片",
    clickToSend: "点击直接发送",
    startNewConversation: "开始新的对话",
    inspirationSuggestions: "灵感建议",
    suggestionGeneratedHint: "根据你的近期内容生成，点击即可发送",
    suggestionFallbackHint: "系统内置建议，配置模型后会定期刷新",
    suggestionsUpdating: "更新中",
    suggestionsCount: (count) => `${count} 条`,
    featuredSuggestion: "重点灵感",
    moreSuggestion: "更多灵感",
    showMoreInspirations: "显示更多灵感",
    hideMoreInspirations: "收起更多灵感",
    moreInspirationBubble: "点我获取更多灵感",
    emptyGreeting: (name) => `我能帮什么忙吗，${name}？`,
    notProvided: "未提供",
    answerCopied: "已复制回答",
    applicationStatus: "最近一次申请：",
    reviewNote: "审核备注：",
    requestPlaceholder: "简单说明你的使用场景。",
    pleaseTryLater: "请稍后再试",
    currentlyUnavailable: "当前还不能直接提问",
    sourceCustom: "自定义 API",
    sourceGrant: "管理员授权",
    sourceNone: "暂无来源",
    modeAdminDelegated: "管理员代查",
    modeVisibleUser: "可见页读取",
    modeSelf: "本人数据",
    stepKindFinalAnswer: "最终回答",
    stepKindWarning: "能力提示",
    stepKindGeneric: "过程",
    stepKindPhase: "执行阶段",
    phaseCount: (count) => `${count} 个阶段`,
    messagesCount: (count) => `${count} 条消息`,
    thinkingStages: (count) => `${count} 个思考阶段`,
    noExplicitThinking: "无显式思考阶段",
    toolCallsTimes: (count) => `${count} 次工具调用`,
    noToolCalls: "未调用工具",
    traceExecutionTitle: "执行轨迹",
    traceExecutionHint: "把思考和工具动作整理成可读的脉络。",
    traceKeySignal: "关键判断",
    traceNextStep: "下一步",
    traceInput: "输入",
    traceResult: "结果",
    tracePayload: "详情",
    traceRunning: "正在思考",
    traceToolRunning: "正在调用工具",
    traceNoExplicitThinking: "蝶灵正在组织回答；如果模型返回显式思考，会在这里浮现。",
    traceStatusFailed: "异常",
    traceStatusRunning: "正在推理",
    traceStatusCompleted: "已完成",
    traceStatusCancelled: "已停止",
    runStoppedNote: "⏹ 已被用户停止",
    runReleasedBackground: "已切换会话，原任务在后台继续，可从顶部指示条跳回。",
    taskPanelRunningTitle: "正在运行的任务",
    taskPanelJump: "跳到任务",
    taskPanelStop: "停止",
    taskPanelPhase: "阶段",
    taskPanelSections: "章节",
    taskPanelTools: "工具调用",
    taskPanelDuration: "运行时长",
    taskPanelPhaseWriting: "撰写中",
    taskPanelPhaseCompiling: "编译中",
    taskPanelPhaseThinking: "推理中",
    traceKeyJudgement: (count) => `关键判断 ${count}`,
    tracePendingConfirm: (count) => `待确认 ${count}`,
    traceEvidence: "依据",
    traceApproxDuration: (seconds) => `约 ${seconds}s`,
    traceToolProgress: "进度",
    traceQueued: "排队中",
    traceCompletedSummary: "已完成",
    viewExecution: "查看执行过程",
    executionHint: "回答完成后默认收起，需要时再展开思考或工具调用。",
    thinkingProcess: "思考过程",
    toolCallProcess: "工具调用过程",
    generatingMessage: "正在思考并生成回答...",
    stepWhatDoing: "这一步在做什么",
    stepSupplementalData: "补充当前回答所需的数据",
    stepInputInfo: "本次传入的信息",
    stepWhatGot: "这一步得到了什么",
    stepWhyResult: "为什么是这个结果",
    stepDataSummary: "返回的数据摘要",
    stepWhatReturned: "工具返回了什么",
    stepWhyFailed: "为什么失败了",
    stepFallbackNote: "正文已经显示在下方，这里只保留阶段记录。",
    heroTitle: "蝶灵 · SoulWing",
    heroDescription: "你的专属 AI 助手。保留每一次对话，按你的权限访问站内数据，帮助你记录、整理、创作和行动。",
    codexViewTitle: "更接近 Codex 的执行视图",
    codexViewDescription: "支持流式正文、工具调用轨迹、多图输入和 provider 能力降级提示。",
    desktopPlaceholder: "输入你的问题，例如总结近况、查看聊天、搜索消息，或结合多张图片进行分析。",
    mobilePlaceholder: "输入问题",
    mobileConversationsHint: "手机端把会话列表收进这里，聊天主界面保持更干净。",
    loadAiStatusFailed: "加载 AI 状态失败",
    loadConversationsFailed: "加载会话失败",
    loadMessagesFailed: "加载消息失败",
    loadAiFailed: "加载蝶灵失败",
    createConversationFailed: "创建会话失败",
    renameConversationFailed: "重命名失败",
    deleteConversationFailed: "删除会话失败",
    submitRequestFailed: "提交申请失败",
    aiRequestSubmitted: "已提交 AI 使用申请",
    imageUploadFailed: "图片上传失败",
    sendFailed: "发送失败",
    generateFailedRetry: "生成失败，请稍后重试。",
    noAvailableAiHint: "当前没有可用的 AI 来源，请先配置个人 API 或提交申请。",
    saveConfigFailed: "保存配置失败",
    configSaved: "AI 配置已保存",
    testConnectionFailed: "连接测试失败",
    testConnectionSuccess: "连接测试成功",
    deleteConfigFailed: "删除配置失败",
    configDeleted: "已删除自定义 AI 配置",
    settingsSheetTitle: "AI 模型配置",
    settingsSheetDescription: "按 OpenAI-compatible 方式保存 provider。测试时会探测流式、工具调用、图片理解和思考流能力。",
    storageNotReadyWarning: "服务端未配置 AI_SECRET_KEY，当前无法安全保存或更新 AI 凭证。请先在项目根目录的 .env 中添加该变量，并重启开发服务器。",
    currentMask: "当前掩码",
    notConfigured: "尚未配置",
    lastTest: "最近测试：",
    apiKeyPlaceholder: "输入新的 API Key 用于更新",
    modelPlaceholder: "gpt-4.1-mini / deepseek-chat / qwen...",
    modelListLabel: "快速切换模型列表",
    modelListPlaceholder: "每行输入一个模型，例如：",
    modelListHint: "本地保存，与当前 provider 绑定。保存后可在对话输入框的「高级」菜单中快速切换模型。",
    streamEnabledHint: "provider 支持时会沿用这个开关。",
    enableConfigLabel: "启用这份配置",
    enableConfigHint: "关闭后会退回到管理员授权或不可用状态。",
    testingConnection: "测试中...",
    testConnectionBtn: "测试连接",
    savingConfig: "保存中...",
    saveConfigBtn: "保存配置",
    deleteConfigBtn: "删除配置",
    capabilityDescriptionTitle: "Provider 能力说明",
    capabilityDescriptionHint: "如果某项能力灰掉，AI 页面会明确提示降级原因，例如不支持多图理解、原生工具调用或 reasoning 流，而不会伪装成成功执行。",
    configName: "配置名称",
    configNamePlaceholder: "例如：我的 OpenAI 密钥",
    savedConfigs: "已保存的配置",
    activeConfig: "活跃配置",
    noSavedConfigs: "暂无保存的配置",
    loadConfig: "加载",
    newConfig: "新建配置",
    activateConfig: "设为活跃",
    configActivated: "已切换活跃配置",
    deleteConfigConfirm: "确认删除",
    confirmDeleteConfig: "确定要删除配置「{name}」吗？此操作不可撤销。",
    loadConfigPrompt: "选择要加载的配置（API 密钥需重新输入）",
    loadingConfigs: "加载中...",
    activeBadge: "活跃",
    notActive: "未激活",
    stepSystemCalled: "系统调用了",
    stepPurposeIs: "目的是",
    reasonReady: "已可用",
    reasonServerSecretMissing: "服务端缺少 AI 安全配置",
    reasonConfigurePersonalApi: "请先配置个人 API",
    reasonRequestAccess: "请先申请访问权限",
    reasonUnavailable: "暂时不可用",
    adminGrantRequest: "向管理员申请免费使用",
    adminGrantDesc: "如果你暂时不想使用自己的 API，也可以向管理员申请一个免费模型授权。",
    applyForGrant: "提交申请",
    cancelRequest: "撤回申请",
    cancelRequestConfirm: "确定要撤回申请吗？",
    requestCancelled: "申请已撤回",
    adminGrantConfigured: "管理员已为你配置模型",
    adminGrantActive: "管理员授权的模型配置",
    adminGrantPausedHint: "该模型已被管理员暂停使用，请联系管理员",
    adminGrantRevokedHint: "该配置已被管理员弃用",
    sourceSelf: "自行配置",
    sourceAdminGrant: "管理员授权",
    requestStatusPending: "审核中",
    requestStatusApproved: "已通过",
    requestStatusRejected: "已拒绝",
    requestStatusCancelled: "已撤回",
    requestStatusConfigured: "已配置",
    grantStatusActive: "活跃",
    grantStatusPaused: "管理员已暂停",
    grantStatusRevoked: "管理员已弃用",
    grantStatusDeprecated: "管理员已弃用",
    activateFailed: "激活失败",
  },
  comments: {
    title: "评论",
    loading: "加载评论中...",
    noComments: "还没有评论。",
    placeholder: "写下评论...",
    sending: "发送中...",
    post: "发表评论",
    hideReplies: (n) => `隐藏 ${n} 条回复`,
    showReplies: (n) => `展开 ${n} 条回复`,
    reply: "回复",
    delete: "删除",
    replyTo: "回复",
    sendingReply: "发送中...",
    sendReply: "发送回复",
    deleted: "评论已删除",
  },
  guestbook: {
    title: "留言板",
    placeholder: "留下你的留言...",
    sending: "提交中...",
    submit: "留言",
    noMessages: "还没有人留言...",
    justNow: "刚刚",
    minutesAgo: (n) => `${n} 分钟前`,
    hoursAgo: (n) => `${n} 小时前`,
    daysAgo: (n) => `${n} 天前`,
  },
  stickers: {
    defaultTab: "默认",
    customTab: "我的",
    publicTab: "公用",
    communityStickers: "社区表情包",
    addToCustom: "添加到我的表情",
    savedToCustom: "已保存到自定义表情。",
    contributeToCommunity: "贡献到表情社区",
    contributed: "已贡献到社区表情库。",
    createGroup: "创建分组",
    renameGroup: "重命名分组",
    deleteGroup: "删除分组",
    addToGroup: "已添加到分组",
    removeFromGroup: "已从分组移除",
    groupName: "分组名称",
    manageGroups: "管理分组",
    close: "关闭",
    back: "返回",
  },
  images: {
    title: "图片库",
    used: "已用",
    loading: "加载中...",
    noImages: "还没有上传过图片",
    copyMarkdown: "复制 Markdown",
    copiedMarkdown: "已复制 Markdown",
    delete: "删除",
    insertIntoEditor: "插入编辑器",
    copyLink: "复制链接",
    download: "下载",
    confirmDelete: (name) => `确认删除「${name}」吗？此操作不可恢复。`,
    deleted: "图片已删除",
    deleteFailed: "删除图片失败",
  },
  jobs: {
    title: "求职",
    description: "记录投递进度、回复状态和求职渠道，帮助你追踪每一次求职机会。",
    total: "总投递",
    replied: "有回复",
    interviewRate: "面试率",
    offerRate: "Offer 率",
    replyRate: "回复率",
    statusChart: "状态分布",
    channelChart: "渠道分布",
    trendChart: "月度趋势",
    search: "搜索公司、职位...",
    allStatus: "全部",
    newApplication: "新建申请",
    editApplication: "编辑申请",
    detail: "详情",
    company: "公司",
    position: "职位",
    channel: "渠道",
    appliedAt: "投递日期",
    status: "状态",
    notes: "备注",
    baseLocation: "工作地点",
    hrContact: "HR 联系方式",
    link: "招聘链接",
    save: "保存",
    saving: "保存中...",
    cancel: "取消",
    delete: "删除",
    noData: "还没有求职记录，点击右上角新建。",
    deleteConfirm: (company) => `确认删除「${company}」的求职记录吗？此操作不可恢复。`,
    deleted: "求职记录已删除",
    saved: "求职记录已保存",
    deleteFailed: "删除求职记录失败",
  },
  interviews: {
    title: "面试",
    description: "管理面试安排、面试结果和复盘记录，帮助你沉淀求职经验。",
    total: "总面试",
    passed: "已通过",
    failed: "未通过",
    pending: "待反馈",
    passRate: "通过率",
    roundChart: "轮次分布",
    formatChart: "形式分布",
    companyChart: "公司分布",
    newInterview: "新建面试",
    editInterview: "编辑面试",
    company: "公司",
    position: "职位",
    round: "面试轮次",
    format: "面试形式",
    scheduledAt: "面试时间",
    interviewers: "面试官",
    questions: "面试问题",
    selfRating: "自评",
    result: "面试结果",
    feedback: "面试反馈",
    detail: "详情",
    linkJob: "关联求职记录",
    noJob: "不关联",
    save: "保存",
    saving: "保存中...",
    cancel: "取消",
    delete: "删除",
    noData: "还没有面试记录，点击右上角新建。",
    deleteConfirm: (company) => `确认删除「${company}」的面试记录吗？此操作不可恢复。`,
    deleted: "面试记录已删除",
    saved: "面试记录已保存",
    deleteFailed: "删除面试记录失败",
  },
  resume: {
    title: "简历",
    edit: "编辑",
    editHint: "点击右上角「编辑」开始编写简历。",
    back: "返回简历",
    preview: "预览",
    saving: "保存中...",
    save: "保存",
    pdfMode: "应用 PDF 模式",
    contentLabel: "简历内容",
    previewLabel: "简历预览",
    currentVersion: "当前简历版本",
    noPdf: "还没有上传 PDF 版本的简历。",
    uploadNew: "上传新版本",
    versionPlaceholder: "版本名...",
    selectPdf: "选择 PDF 文件",
    uploading: "上传中...",
    uploadCreatesVersion: "上传会创建一个新版本，不会影响当前展示版本。",
    versions: "简历版本",
    noVersions: "暂无简历版本",
    currentDisplay: "当前展示",
    setDisplay: "设为展示",
    downloadVersion: "下载",
    deleteVersion: "删除版本",
    deleteVersionConfirm: (name) => `确认删除版本「${name}」吗？`,
    saved: "简历已保存",
    saveFailed: "保存简历失败",
    uploaded: "简历版本已上传",
    uploadFailed: "上传简历失败",
    versionDeleted: "版本已删除",
    displayUpdated: "已设为当前展示版本",
    displayUpdateFailed: "设置展示版本失败",
    templates: "模板",
    themeLabel: "主题",
    themeFallback: "请求的主题不可用，已自动切换",
    noThemes: "还没有可用的简历主题。请先安装 jsonresume-theme-* 包",
    renderFailed: "简历渲染失败",
    goTemplates: "前往模板中心切换其它主题",
    markdownBanner: "这是旧版 Markdown 内容。建议切换到在线简历以获得更好的展示效果。",
    switchToOnline: "切换为在线简历",
    exportPdfSoon: "导出 PDF（即将支持）",
    onlineResume: "在线简历",
    pdfResume: "PDF 简历",
    oldMarkdownLabel: "查看旧版 Markdown 内容（只读）",
  },
  friends: {
    search: "搜索好友...",
    noFriends: "暂无好友",
    online: "在线",
    away: "离开",
    offline: "下线",
    addFriend: "添加好友",
    friendRequests: "好友请求",
    accept: "接受",
    reject: "拒绝",
    moduleLabels: {
      resume: "简历",
      blog: "博客",
      daily: "日常",
      reflections: "心得",
      notes: "笔记",
      jobs: "求职",
      interviews: "面试",
    },
  },
  notifications: {
    newMessage: "你有一条新消息",
    sticker: "[表情]",
    image: "[图片]",
    attachment: "[附件]",
    from: "来自",
    open: "打开",
    sessionExpired: "账号已在其他设备登录",
    sessionExpiredDesc: "你的账号已在另一台设备上登录，当前会话已失效。",
    reLogin: "重新登录",
  },
  error: {
    title: "加载失败",
    description: "页面组件加载时出现错误，这可能是由于网络问题或缓存导致。",
    refreshPage: "刷新页面",
    showDetails: "查看错误详情（开发环境）",
  },
  updates: {
    title: "更新日志",
    backToHome: "返回首页",
    noUpdates: "暂无可展示的更新记录。",
  },
}

// ── English ────────────────────────────────────────────────────────────────

const enUS: Dictionary = {
  common: {
    back: "Back",
    save: "Save",
    saving: "Saving",
    cancel: "Cancel",
    refresh: "Refresh",
    loading: "Loading",
    settings: "Settings",
    edit: "Edit",
    delete: "Delete",
    preview: "Preview",
    publish: "Publish",
    close: "Close",
    confirm: "Confirm",
    search: "Search",
    filter: "Filter",
    all: "All",
    none: "None",
    noData: "No data",
    loadMore: "Load more",
    upload: "Upload",
    uploading: "Uploading",
    download: "Download",
    copy: "Copy",
    copied: "Copied",
    retry: "Retry",
    error: "Error",
    ok: "OK",
    version: "Version",
    show: "Show",
    hide: "Hide",
    print: "Print / Export PDF",
  },
  nav: {
    home: "Home",
    community: "Community",
    resume: "Resume",
    blog: "Blog",
    daily: "Daily",
    reflections: "Reflections",
    notes: "Notes",
    jobs: "Jobs",
    interviews: "Interviews",
    ai: "AI Assistant",
    sql: "SQL Lab",
    sqlPractice: "SQL Practice",
    friends: "Friends",
    admin: "Admin",
    login: "Login",
    logout: "Log out",
    settings: "Settings",
    updates: "Changelog",
  },
  settings: {
    title: "Settings",
    description: "Manage your profile, password requests, privacy, and language.",
    profile: "Profile",
    profileDesc: "Update display name, avatar, location, bio, and email.",
    password: "Password",
    passwordDesc: "Submit a password change request and check approval status.",
    privacy: "Visibility",
    privacyDesc: "Control which modules are visible to friends.",
    language: "Language",
    languageDesc: "Switch between Chinese and English.",
    usage: "Usage Guide",
    usageDesc: "Learn about core features — content creation, career tracking, social tools, community resources, and the AI assistant.",
    profileTitle: "Profile Settings",
    passwordTitle: "Password Change",
    privacyTitle: "Visibility Settings",
    languageTitle: "Language Settings",
    usageTitle: "Usage Guide",
    displayName: "Display name",
    avatarText: "Avatar fallback text",
    avatarUpload: "Upload avatar",
    location: "Location",
    bio: "Bio",
    email: "Email",
    publicSlug: "Public profile URL",
    publicSlugHint: "Optional. Use lowercase letters, numbers, and hyphens only. Public links will prefer it after saving.",
    copyPublicLink: "Copy public profile link",
    publicLinkCopied: "Public profile link copied",
    publicLinkCopyFailed: "Copy failed. Please copy manually.",
    profileSaved: "Profile saved",
    profileSaveFailed: "Failed to save profile",
    avatarImageOnly: "Please choose an image file",
    avatarTooLarge: "Avatar image must be under 5MB",
    passwordInput: "Enter a new password",
    passwordConfirm: "Confirm the new password",
    passwordSubmit: "Submit request",
    passwordStatus: "Check status",
    passwordRequested: "Password change request submitted successfully.",
    passwordRequestFailed: "Failed to submit the password change request",
    passwordNoRequest: "No password change request yet.",
    passwordApproved: "Your latest password change request has been approved.",
    passwordPending: "Your latest password change request is still pending.",
    passwordRejected: "Your latest password change request did not take effect.",
    passwordMismatch: "The two password entries do not match.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    visibilityHint: "Module and article visibility are layered: a public module does not publish every article, and a public article still requires its module to be visible.",
    privateVisibility: "Private",
    friendsVisibility: "Friends only",
    publicVisibility: "Public",
    languageHint: "Your language preference is saved to your account and applied immediately.",
    chinese: "Chinese",
    english: "English",
    languageSaved: "Language preference saved",
    profilePageDesc: "Your nickname and avatar appear in the site header, friend list, chat, and comment sections.",
    nickname: "Nickname",
    signature: "Signature",
    changePassword: "Change password",
    currentVersion: "Current resume version",
    uploadNewVersion: "Upload new version",
    versionName: "Version name...",
    selectPdf: "Select PDF file",
    uploadCreatesNewVersion: "Upload creates a new version without affecting the current one.",
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
    groupInfo: "Group info",
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
    ownerOnly: "Only the group owner can edit group details and members.",
    noAnnouncement: "No group announcement yet",
    manageHiddenForWorld: "The world channel has no management page",
    confirmRemove: (name) => `Remove ${name} from this group?`,
    confirmLeave: "Leave this group?",
    confirmDissolve: "Dissolve this group? This cannot be undone.",
    notFound: "Group not found or access denied.",
    openGroupInfo: "Open group info",
    hide: "Hide",
    history: "History",
    loadEarlier: "Load earlier messages",
    loadFailedMessages: "Failed to load",
  },
  admin: {
    title: "Admin Console",
    description: "Review access requests, manage members, and inspect recent operations.",
    pendingApprovals: "Pending approvals",
    loadedUsers: "Loaded users",
    admins: "Admins",
    loading: "Loading...",
    adminPermissions: "Admin permissions",
    transferOwnership: "Transfer ownership",
    transferOwnerDesc: "Choose another admin or member to become the owner. You will keep admin access after the transfer.",
    selectNewOwner: "Select the new owner",
    transferOwner: "Transfer owner",
    transferredOwner: "Ownership transferred",
    chooseAdminEdit: "Choose an admin to edit permissions",
    noExtraAdmins: "No extra admins available.",
    permissionsEnabled: (n) => `${n} permissions enabled`,
    close: "Close",
    registrationApprovals: "Registration approvals",
    noRegistrationRequests: "No pending registration requests.",
    approve: "Approve",
    approved: "Registration approved",
    passwordApprovals: "Password change approvals",
    noPasswordRequests: "No pending password change requests.",
    announcements: "Announcements",
    announcementPlaceholder: "Write the announcement text shown on the site home page.",
    publishing: "Publishing...",
    publishAnnouncement: "Publish announcement",
    noAnnouncements: "No announcement history yet.",
    worldChannel: "World channel",
    adminSource: "Admin",
    deleteAnnouncement: "Delete announcement",
    worldBroadcasts: "World channel broadcasts",
    noBroadcasts: "No broadcast history yet.",
    deleteBroadcast: "Delete broadcast",
    manageStickers: "Public sticker library",
    uploadPublicStickers: "Upload public stickers",
    stickerDeleted: "Sticker deleted",
    deleteSticker: "Delete sticker",
    userManagement: "User management",
    userTable: {
      displayName: "User",
      role: "Role",
      lastLogin: "Last login",
      deleteRule: "Delete rule",
      actions: "",
    },
    role: {
      user: "User",
      admin: "Admin",
      owner: "Owner",
    },
    deleteBlocked: {
      self: "Cannot delete yourself",
      owner: "Cannot delete the owner",
      neverLogin: "Never logged in",
      daysRemaining: (n) => `${n} days remaining`,
    },
    deletable: "Deletable",
    deleteUser: "Delete user",
    transfer: "Transfer",
    loadingMoreUsers: "Loading more users...",
    recentActivity: "Recent activity",
    lastRefresh: "Last refresh",
    notRefreshedYet: "Not refreshed yet",
    refreshLogs: "Refresh logs",
    refreshing: "Refreshing...",
    refreshGeo: "Refresh geo data",
    noActivity: "No activity records yet.",
    activityTable: {
      time: "Time",
      action: "Action",
      userDetail: "User and detail",
      ipAddress: "IP address",
      geo: "Geo",
      device: "Device",
    },
    system: "System",
    unknown: "Unknown",
    loadingMoreActivity: "Loading more activity...",
    changelogDisplay: "Public changelog display",
    noUpdateRecords: "No git update records yet.",
    originalNote: "Original note",
    status: {
      hidden: "Hidden",
      showingOriginalNote: "Showing original note",
      showingCustomNote: "Showing custom note",
    },
    saveCustomNote: "Save custom note",
    restoreOriginal: "Restore original",
    hideEntry: "Hide entry",
    failedToLoad: "Failed to load admin overview",
    roleUpdated: "User role updated",
    ownershipTransferred: "Ownership transferred",
    announcementPublished: "Announcement published",
    announcementDeleted: "Announcement deleted",
    broadcastDeleted: "Broadcast deleted",
    stickersUploaded: "Public stickers uploaded",
    stickerDeleteFailed: "Upload failed",
    userDeleted: "User deleted",
    updateLogSaved: "Update log display saved",
    originalRestored: "Original commit note restored",
    updateHidden: "Update hidden from changelog",
    geoRefreshed: (updated, failed) => `Geo lookup updated ${updated} records, ${failed} failed`,
    permissionsUpdated: "Admin permissions updated",
    neverLoggedIn: "Never logged in",
    loadingFailed: "Failed to load",
    aiPanel: {
      title: "AI Assistant",
      refresh: "Refresh",
      refreshing: "Refreshing...",
      newGrant: "New Grant",
      pendingRequests: "Pending Requests",
      activeGrants: "Active Grants",
      registeredTools: "Registered Tools",
      accessRequests: "Access Requests",
      noRequests: "No AI access requests.",
      reviewNote: "Review note",
      review: "Review",
      configureGrant: "Configure Grant",
      systemGrants: "System Grants",
      noGrants: "No system grants.",
      configGrant: "Configure AI Grant",
      targetAdmin: "Target admin",
      targetUser: "Target user",
      selectOne: "Select one",
      searchUserPlaceholder: "Search or select user...",
      noUsersAvailable: "No users available for authorization",
      noMatchingUsers: "No matching users",
      configGrantDesc: "Select the user to receive this AI configuration. Once saved, the user can select and use this model in their AI assistant settings; you can still pause, resume, or revoke this grant from the admin panel.",
      providerLabel: "Provider label",
      baseUrl: "Base URL",
      apiKey: "API key",
      model: "Model",
      temperature: "Temperature",
      saveGrant: "Save Grant",
      cancel: "Cancel",
      pause: "Pause",
      revoke: "Revoke",
      recentAudit: "Recent Audit Actions",
      noAudit: "No audit entries yet.",
      registeredToolsTitle: "Registered Tools",
      reviewRequest: "Review AI Access Request",
      reviewRequestDesc: "Approving a request does not remove the option to use a personal provider key.",
      optionalNote: "Optional review note",
      reject: "Reject",
      approve: "Approve",
      updated: "Updated",
      failed: "Failed to load",
      grantSaved: "AI grant saved",
      grantPaused: "Grant paused",
      grantRevoked: "Grant revoked",
      requestApproved: "AI request approved",
      requestRejected: "AI request rejected",
      restore: "Restore",
      deleteGrant: "Delete",
      deleteGrantConfirm: "Delete this grant record? The user will lose access to this grant.",
      grantDeleted: "Grant deleted",
      grantRestored: "Grant restored",
      grantDeprecated: "Grant deprecated",
      modelListLabel: "Model List",
      modelListHint: "One model per line. Users can only switch within this list.",
      statusActive: "Active",
      statusPaused: "Paused",
      statusRevoked: "Revoked",
      statusDeprecated: "Deprecated",
      statusConfigured: "Configured",
      statusCancelled: "Cancelled",
      statusApproved: "Approved",
      statusRejected: "Rejected",
      awaitingConfig: "Awaiting config",
      configured: "Configured",
      editGrantTitle: "Edit AI Grant",
      editGrantDesc: "Modify the AI model grant configuration for this user. Leave the API key empty to keep the existing key.",
      saveEdit: "Save changes",
      savedEdit: "AI grant updated",
      apiKeyEditPlaceholder: "Leave empty to keep existing key",
      grantUserInfo: "Grant user",
      grantStatusLabel: "Grant status",
    },
  },
  auth: {
    email: "Email",
    password: "Password",
    passwordPlaceholder: "Enter password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    login: "Login",
    loggingIn: "Logging in...",
    resetPassword: "Reset / recover password",
    registerEmail: "Registered email",
    newPasswordMin: "New password (min 8 characters)",
    newPasswordPlaceholder: "Enter your desired new password",
    submitting: "Submitting...",
    submitRequest: "Submit request",
    checking: "Checking...",
    checkStatus: "Check status",
    networkError: "Network error, please try again later",
    loginFailed: "Login failed, please try again later",
    nickname: "Display name",
    namePlaceholder: "Your name",
    passwordMin: "Password (min 8 characters)",
    submitRegistration: "Submit registration",
    checkApproval: "Check approval status",
    goToLogin: "Go to login",
    registrationSubmitted: "Registration submitted. Waiting for admin approval.",
    registrationFailed: "Registration failed, please try again later",
    passwordChangeSubmitted: "Password change request submitted. Waiting for admin approval.",
    noRequest: "No password change request found for this email",
    approved: "Approved! Your new password is now active. You can log in.",
    pending: "Request is still pending admin review",
    rejected: "The latest request was not approved",
    requestFailed: "Submission failed",
    checkFailed: "Check failed",
    noEmail: "Please enter your registered email to check the status",
  },
  article: {
    backTo: (label) => `Back to ${label}`,
    publishedAt: "Published",
    updatedAt: "Updated",
    author: "Author",
    uncategorized: "Uncategorized",
    wordCount: "Word count",
    readingTime: "Reading time",
    minutes: "min",
    toc: "Contents",
    noHeadings: "No headings",
    edit: "Edit",
    share: "Share",
    shareCopied: "Article link copied",
    shareCopyFailed: "Copy failed. Please copy manually.",
    shareNeedsPublic: "Set both the article and its module to public before sharing.",
    new: "New",
    count: (n) => `${n} articles`,
    empty: (label) => `No ${label} yet. Click "New" to create one.`,
    deleteConfirm: (title) => `Delete "${title}"? This cannot be undone.`,
    deleteSuccess: "Article deleted",
    deleteFailed: "Failed to delete article",
    visibilityLabel: "Article visibility",
    visibilityPrivate: "Private",
    visibilityFriends: "Friends only",
    visibilityPublic: "Public",
    visibilityUpdated: "Visibility updated",
    visibilityFailed: "Failed to update visibility",
    folder: "Folder",
    moveToFolder: "Moved to folder",
    movedToFolder: "Moved to folder",
    movedToUncategorized: "Moved to uncategorized",
    moveFailed: "Failed to move",
  },
  editor: {
    backToList: (label) => `Back to ${label}`,
    backToView: "Back to view mode",
    preview: "Preview",
    delete: "Delete",
    publish: "Publish",
    save: "Save",
    saving: "Saving...",
    title: "Title",
    titlePlaceholder: "Enter title...",
    summary: "Excerpt",
    summaryPlaceholder: "Short description shown in lists...",
    date: "Date",
    tags: "Tags (comma separated)",
    tagsPlaceholder: "Tags",
    visibility: "Visibility",
    visibilityHint: "Friends-only means signed-in friends can view. External visitors cannot see it.",
    folder: "Folder",
    folderUncategorized: "Uncategorized",
    content: "Content",
    contentPlaceholder: "Start writing...",
    deleteConfirm: (title) => `Delete "${title}"? This cannot be undone.`,
    deleteCancelled: "Deletion cancelled",
    published: "Article published",
    publishedAndRedirect: "Published, redirecting...",
    saved: "Saved",
    draftLoaded: "Draft loaded from last session",
    loadEditor: "Loading editor...",
    startWriting: "Start writing...",
    confirmEditShortcut: "Press Enter or Escape to confirm",
    editLatex: "Edit LaTeX formula...",
    insertColumnLeft: "Insert column left",
    insertColumnRight: "Insert column right",
    insertRowAbove: "Insert row above",
    insertRowBelow: "Insert row below",
    deleteColumn: "Delete column",
    deleteRow: "Delete row",
    mergeCells: "Merge cells",
    splitCell: "Split cell",
    deleteTable: "Delete entire table",
    toggleHeader: "Toggle header",
    headerRow: "Header row",
    tableStyle: "Table style",
    enterMarkdown: "Type Markdown here...",
  },
  home: {
    heroTitle: "Home",
    heroSubtitle: "",
    noUpdates: "No updates to display yet.",
    backToHome: "Back to home",
    editLayout: "Edit layout",
    saveLayout: "Save layout",
    restoreLayout: "Restore default",
    layoutSaved: "Layout saved",
    layoutRestored: "Layout restored to default",
    visitStats: "Visit stats",
    heatmapTitle: "Home page visits (last 26 weeks)",
    moduleViews: "Module page views",
    noVisits: "No visit records",
    recentVisits: "Recent visits",
    noDetails: "No details",
    anonymous: "Anonymous",
    visitor: "Visitor",
    channel: "Channel",
    announcement: "Announcement",
    announcements: "Announcements",
    latestArticles: "Latest articles",
    jobStats: "Job stats",
    total: "Total",
    replied: "Replied",
    interviews: "Interviews",
    offers: "Offers",
    replyRate: "Reply rate",
  },
  ai: {
    title: "AI Assistant",
    manageAuth: "Manage AI access",
    send: "Send",
    thinking: "Thinking",
    streaming: "Streaming",
    toolCalling: "Tool calling",
    imageUnderstanding: "Image understanding",
    thinkingStream: "Thinking stream",
    clearChat: "Clear chat",
    chatHistory: "Chat history",
    newConversation: "New conversation",
    typeMessage: "Type a message...",
    emptyState: "Start a new conversation.",
    error: "Request failed",
    retry: "Retry",
    settings: "Settings",
    providerLabel: "Provider label",
    baseUrl: "Base URL",
    apiKey: "API Key",
    model: "Model",
    temperature: "Temperature",
    streamEnabled: "Enable streaming",
    saveSettings: "Save settings",
    settingsSaved: "Settings saved",
    requestAccess: "Request access",
    accessRequested: "Access request submitted",
    requestingAccess: "Requesting...",
    accessPending: "Your AI access request is pending admin review.",
    accessDenied: "You do not have AI access. Please request access or use a personal API key.",
    noGrants: "No available grants",
    grantPaused: "Grant paused",
    grantRevoked: "Grant revoked",
    newChat: "New",
    conversations: "Conversations",
    sidebarAssistantSubtitle: "AI assistant",
    conversationToday: "Today",
    conversationRecent7Days: "Recent 7 days",
    conversationEarlier: "Earlier",
    soulwingSettings: "SoulWing settings",
    personalVersion: "Personal",
    more: "More",
    advanced: "Advanced",
    generating: "Generating",
    sendMessage: "Send message",
    configureApi: "Configure API",
    openAiSettings: "Open AI settings",
    loadingAi: "Loading SoulWing...",
    switchConversation: "Switch conversation",
    chatSettings: "Chat settings",
    currentSource: "Current source",
    noModelSelected: "No model selected",
    removeImage: "Remove image",
    uploadImage: "Upload image",
    clickToSend: "Click to send",
    startNewConversation: "Start a new conversation",
    inspirationSuggestions: "Inspiration prompts",
    suggestionGeneratedHint: "Generated from your recent context. Click to send.",
    suggestionFallbackHint: "Built-in prompts. They refresh after the model is configured.",
    suggestionsUpdating: "Updating",
    suggestionsCount: (count) => `${count} prompts`,
    featuredSuggestion: "Featured",
    moreSuggestion: "More ideas",
    showMoreInspirations: "Show more ideas",
    hideMoreInspirations: "Hide more ideas",
    moreInspirationBubble: "Tap me for more ideas",
    emptyGreeting: (name) => `How can I help, ${name}?`,
    notProvided: "Not provided",
    answerCopied: "Answer copied",
    applicationStatus: "Last request:",
    reviewNote: "Review note:",
    requestPlaceholder: "Briefly describe your use case.",
    pleaseTryLater: "Please try again later",
    currentlyUnavailable: "Cannot ask questions right now",
    sourceCustom: "Custom API",
    sourceGrant: "Admin grant",
    sourceNone: "No source",
    modeAdminDelegated: "Admin delegated",
    modeVisibleUser: "Visible page",
    modeSelf: "Own data",
    stepKindFinalAnswer: "Final answer",
    stepKindWarning: "Capability note",
    stepKindGeneric: "Process",
    stepKindPhase: "Execution phase",
    phaseCount: (count) => `${count} phases`,
    messagesCount: (count) => `${count} messages`,
    thinkingStages: (count) => `${count} thinking stages`,
    noExplicitThinking: "No explicit thinking stage",
    toolCallsTimes: (count) => `${count} tool calls`,
    noToolCalls: "No tool calls",
    traceExecutionTitle: "Execution trace",
    traceExecutionHint: "Thinking and tool actions are organized into readable notes.",
    traceKeySignal: "Key signal",
    traceNextStep: "Next step",
    traceInput: "Input",
    traceResult: "Result",
    tracePayload: "Payload",
    traceRunning: "Thinking",
    traceToolRunning: "Calling tool",
    traceNoExplicitThinking: "SoulWing is forming the answer. Explicit thinking will appear here if the provider streams it.",
    traceStatusFailed: "failed",
    traceStatusRunning: "thinking",
    traceStatusCompleted: "completed",
    traceStatusCancelled: "stopped",
    runStoppedNote: "⏹ Stopped by you",
    runReleasedBackground: "Switched conversation — the task keeps running in the background. Use the top bar to jump back.",
    taskPanelRunningTitle: "Running task",
    taskPanelJump: "Jump to task",
    taskPanelStop: "Stop",
    taskPanelPhase: "Phase",
    taskPanelSections: "Sections",
    taskPanelTools: "Tool calls",
    taskPanelDuration: "Elapsed",
    taskPanelPhaseWriting: "Writing",
    taskPanelPhaseCompiling: "Compiling",
    taskPanelPhaseThinking: "Thinking",
    traceKeyJudgement: (count) => `Key judgement ${count}`,
    tracePendingConfirm: (count) => `Pending check ${count}`,
    traceEvidence: "Evidence",
    traceApproxDuration: (seconds) => `about ${seconds}s`,
    traceToolProgress: "Progress",
    traceQueued: "Queued",
    traceCompletedSummary: "Completed",
    viewExecution: "View execution process",
    executionHint: "Collapsed by default after completion. Expand to review thinking and tool calls.",
    thinkingProcess: "Thinking process",
    toolCallProcess: "Tool call process",
    generatingMessage: "Thinking and generating response...",
    stepWhatDoing: "What this step does",
    stepSupplementalData: "supplemental data for the current response",
    stepInputInfo: "Input information",
    stepWhatGot: "What was obtained",
    stepWhyResult: "Why this result",
    stepDataSummary: "Returned data summary",
    stepWhatReturned: "What the tool returned",
    stepWhyFailed: "Why it failed",
    stepFallbackNote: "The full response is displayed below. This section only keeps a stage record.",
    heroTitle: "SoulWing · Butterfly Spirit",
    heroDescription: "Your personal AI assistant. Every conversation is preserved, data access is scoped to your permissions, helping you record, organize, create, and act.",
    codexViewTitle: "A Codex-like execution view",
    codexViewDescription: "Streaming text, tool call traces, multi-image input, and provider capability degradation hints.",
    desktopPlaceholder: "Ask a question — summarize recent activity, search messages, or analyze with multiple images.",
    mobilePlaceholder: "Type a message",
    mobileConversationsHint: "Conversation list is tucked into this panel on mobile so the chat view stays clean.",
    loadAiStatusFailed: "Failed to load AI status",
    loadConversationsFailed: "Failed to load conversations",
    loadMessagesFailed: "Failed to load messages",
    loadAiFailed: "Failed to load SoulWing",
    createConversationFailed: "Failed to create conversation",
    renameConversationFailed: "Failed to rename",
    deleteConversationFailed: "Failed to delete conversation",
    submitRequestFailed: "Failed to submit request",
    aiRequestSubmitted: "AI access request submitted",
    imageUploadFailed: "Failed to upload image",
    sendFailed: "Failed to send",
    generateFailedRetry: "Generation failed, please retry.",
    noAvailableAiHint: "No available AI source. Please configure a personal API or submit an access request.",
    saveConfigFailed: "Failed to save configuration",
    configSaved: "AI configuration saved",
    testConnectionFailed: "Connection test failed",
    testConnectionSuccess: "Connection test successful",
    deleteConfigFailed: "Failed to delete configuration",
    configDeleted: "Custom AI configuration deleted",
    settingsSheetTitle: "AI Model Configuration",
    settingsSheetDescription: "Saved in an OpenAI-compatible format. Tests probe streaming, tool calling, image understanding, and reasoning stream capabilities.",
    storageNotReadyWarning: "AI_SECRET_KEY is not configured on the server. AI credentials cannot be safely saved or updated. Add this variable to the .env file in the project root and restart the dev server.",
    currentMask: "Current mask",
    notConfigured: "Not configured",
    lastTest: "Last test:",
    apiKeyPlaceholder: "Enter a new API Key to update",
    modelPlaceholder: "gpt-4.1-mini / deepseek-chat / qwen...",
    modelListLabel: "Model list for quick switch",
    modelListPlaceholder: "Enter one model per line, for example:",
    modelListHint: "Saved locally for this provider. After saving, models can be switched from the \"Advanced\" menu in the chat input.",
    streamEnabledHint: "When the provider supports streaming, this toggle stays in effect.",
    enableConfigLabel: "Enable this configuration",
    enableConfigHint: "When disabled, falls back to admin grant or unavailable state.",
    testingConnection: "Testing...",
    testConnectionBtn: "Test connection",
    savingConfig: "Saving...",
    saveConfigBtn: "Save configuration",
    deleteConfigBtn: "Delete configuration",
    capabilityDescriptionTitle: "Provider capabilities",
    capabilityDescriptionHint: "If a capability is grayed out, the AI page will clearly indicate the degradation reason (e.g., no multi-image understanding, no native tool calling, or no reasoning stream) rather than pretending to execute successfully.",
    configName: "Configuration name",
    configNamePlaceholder: "e.g. My OpenAI Key",
    savedConfigs: "Saved configurations",
    activeConfig: "Active configuration",
    noSavedConfigs: "No saved configurations",
    loadConfig: "Load",
    newConfig: "New configuration",
    activateConfig: "Set as active",
    configActivated: "Active configuration switched",
    deleteConfigConfirm: "Confirm deletion",
    confirmDeleteConfig: "Are you sure you want to delete \"{name}\"? This cannot be undone.",
    loadConfigPrompt: "Select a configuration to load (API key must be re-entered)",
    loadingConfigs: "Loading...",
    activeBadge: "Active",
    notActive: "Inactive",
    stepSystemCalled: "System called",
    stepPurposeIs: "the purpose is",
    reasonReady: "Available",
    reasonServerSecretMissing: "Server missing AI security configuration",
    reasonConfigurePersonalApi: "Please configure a personal API",
    reasonRequestAccess: "Please request access first",
    reasonUnavailable: "Temporarily unavailable",
    adminGrantRequest: "Apply for admin grant",
    adminGrantDesc: "If you prefer not to use your own API key, you can request a free model grant from the admin.",
    applyForGrant: "Submit request",
    cancelRequest: "Cancel request",
    cancelRequestConfirm: "Cancel this access request?",
    requestCancelled: "Request cancelled",
    adminGrantConfigured: "Admin has configured a model for you",
    adminGrantActive: "Admin granted model config",
    adminGrantPausedHint: "This model has been paused by the admin. Please contact the admin.",
    adminGrantRevokedHint: "This configuration has been revoked by the admin.",
    sourceSelf: "Self-configured",
    sourceAdminGrant: "Admin grant",
    requestStatusPending: "Pending",
    requestStatusApproved: "Approved",
    requestStatusRejected: "Rejected",
    requestStatusCancelled: "Cancelled",
    requestStatusConfigured: "Configured",
    grantStatusActive: "Active",
    grantStatusPaused: "Paused by admin",
    grantStatusRevoked: "Revoked by admin",
    grantStatusDeprecated: "Deprecated by admin",
    activateFailed: "Activation failed",
  },
  comments: {
    title: "Comments",
    loading: "Loading comments...",
    noComments: "No comments yet.",
    placeholder: "Write a comment...",
    sending: "Sending...",
    post: "Post comment",
    hideReplies: (n) => `Hide ${n} replies`,
    showReplies: (n) => `Show ${n} replies`,
    reply: "Reply",
    delete: "Delete",
    replyTo: "Reply to",
    sendingReply: "Sending...",
    sendReply: "Send reply",
    deleted: "Comment deleted",
  },
  guestbook: {
    title: "Guestbook",
    placeholder: "Leave a message...",
    sending: "Sending...",
    submit: "Send",
    noMessages: "No messages yet...",
    justNow: "just now",
    minutesAgo: (n) => `${n} minutes ago`,
    hoursAgo: (n) => `${n} hours ago`,
    daysAgo: (n) => `${n} days ago`,
  },
  stickers: {
    defaultTab: "Default",
    customTab: "Mine",
    publicTab: "Public",
    communityStickers: "Community stickers",
    addToCustom: "Add to my stickers",
    savedToCustom: "Saved to your custom stickers.",
    contributeToCommunity: "Contribute to community",
    contributed: "Contributed to community library.",
    createGroup: "Create group",
    renameGroup: "Rename group",
    deleteGroup: "Delete group",
    addToGroup: "Add to group",
    removeFromGroup: "Remove from group",
    groupName: "Group name",
    manageGroups: "Manage groups",
    close: "Close",
    back: "Back",
  },
  images: {
    title: "Image library",
    used: "Used",
    loading: "Loading...",
    noImages: "No images uploaded yet",
    copyMarkdown: "Copy Markdown",
    copiedMarkdown: "Markdown copied",
    delete: "Delete",
    insertIntoEditor: "Insert into editor",
    copyLink: "Copy link",
    download: "Download",
    confirmDelete: (name) => `Delete "${name}"? This cannot be undone.`,
    deleted: "Image deleted",
    deleteFailed: "Failed to delete image",
  },
  jobs: {
    title: "Jobs",
    description: "Track your applications, reply statuses, and job channels to follow every opportunity.",
    total: "Total",
    replied: "Replied",
    interviewRate: "Interview rate",
    offerRate: "Offer rate",
    replyRate: "Reply rate",
    statusChart: "Status distribution",
    channelChart: "Channel distribution",
    trendChart: "Monthly trend",
    search: "Search company, position...",
    allStatus: "All",
    newApplication: "New application",
    editApplication: "Edit application",
    detail: "Details",
    company: "Company",
    position: "Position",
    channel: "Channel",
    appliedAt: "Applied date",
    status: "Status",
    notes: "Notes",
    baseLocation: "Location",
    hrContact: "HR contact",
    link: "Job link",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    delete: "Delete",
    noData: "No job applications yet. Click \"New\" to create one.",
    deleteConfirm: (company) => `Delete the application for "${company}"? This cannot be undone.`,
    deleted: "Application deleted",
    saved: "Application saved",
    deleteFailed: "Failed to delete application",
  },
  interviews: {
    title: "Interviews",
    description: "Manage interview schedules, results, and review notes to build your career experience.",
    total: "Total",
    passed: "Passed",
    failed: "Failed",
    pending: "Pending",
    passRate: "Pass rate",
    roundChart: "Round distribution",
    formatChart: "Format distribution",
    companyChart: "Company distribution",
    newInterview: "New interview",
    editInterview: "Edit interview",
    company: "Company",
    position: "Position",
    round: "Round",
    format: "Format",
    scheduledAt: "Scheduled time",
    interviewers: "Interviewers",
    questions: "Questions",
    selfRating: "Self-rating",
    result: "Result",
    feedback: "Feedback",
    detail: "Details",
    linkJob: "Link to job application",
    noJob: "None",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    delete: "Delete",
    noData: "No interviews yet. Click \"New\" to create one.",
    deleteConfirm: (company) => `Delete the interview for "${company}"? This cannot be undone.`,
    deleted: "Interview deleted",
    saved: "Interview saved",
    deleteFailed: "Failed to delete interview",
  },
  resume: {
    title: "Resume",
    edit: "Edit",
    editHint: "Click \"Edit\" to start writing your resume.",
    back: "Back to resume",
    preview: "Preview",
    saving: "Saving...",
    save: "Save",
    pdfMode: "Apply PDF mode",
    contentLabel: "Resume content",
    previewLabel: "Resume preview",
    currentVersion: "Current resume version",
    noPdf: "No PDF version uploaded yet.",
    uploadNew: "Upload new",
    versionPlaceholder: "Version name...",
    selectPdf: "Select PDF file",
    uploading: "Uploading...",
    uploadCreatesVersion: "Upload creates a new version without affecting the current one on display.",
    versions: "Resume versions",
    noVersions: "No resume versions",
    currentDisplay: "Currently displayed",
    setDisplay: "Set as display",
    downloadVersion: "Download",
    deleteVersion: "Delete version",
    deleteVersionConfirm: (name) => `Delete version "${name}"?`,
    saved: "Resume saved",
    saveFailed: "Failed to save resume",
    uploaded: "Resume version uploaded",
    uploadFailed: "Failed to upload resume",
    versionDeleted: "Version deleted",
    displayUpdated: "Set as current display version",
    displayUpdateFailed: "Failed to set display version",
    templates: "Templates",
    themeLabel: "Theme",
    themeFallback: "Requested theme unavailable, automatically switched",
    noThemes: "No resume themes available. Please install a jsonresume-theme-* package.",
    renderFailed: "Resume rendering failed",
    goTemplates: "Go to template center to switch themes",
    markdownBanner: "This is legacy Markdown content. Switch to online resume for better display.",
    switchToOnline: "Switch to online resume",
    exportPdfSoon: "Export PDF (coming soon)",
    onlineResume: "Online Resume",
    pdfResume: "PDF Resume",
    oldMarkdownLabel: "View legacy Markdown content (read-only)",
  },
  friends: {
    search: "Search friends...",
    noFriends: "No friends yet",
    online: "Online",
    away: "Away",
    offline: "Offline",
    addFriend: "Add friend",
    friendRequests: "Friend requests",
    accept: "Accept",
    reject: "Reject",
    moduleLabels: {
      resume: "Resume",
      blog: "Blog",
      daily: "Daily",
      reflections: "Reflections",
      notes: "Notes",
      jobs: "Jobs",
      interviews: "Interviews",
    },
  },
  notifications: {
    newMessage: "You have a new message",
    sticker: "[Sticker]",
    image: "[Image]",
    attachment: "[Attachment]",
    from: "New message from",
    open: "Open",
    sessionExpired: "Session expired",
    sessionExpiredDesc: "Your account was logged in on another device. This session is no longer active.",
    reLogin: "Log in again",
  },
  error: {
    title: "Failed to load",
    description: "The page component failed to load. This may be caused by network issues or stale cache.",
    refreshPage: "Refresh page",
    showDetails: "Show error details (dev environment)",
  },
  updates: {
    title: "Changelog",
    backToHome: "Back to home",
    noUpdates: "No updates to display yet.",
  },
}

// ── Resolver ───────────────────────────────────────────────────────────────

const dictionaries: Record<AppLocale, Dictionary> = {
  "zh-CN": zhCN,
  "en-US": enUS,
}

export function getDictionary(locale: string): Dictionary {
  return dictionaries[isAppLocale(locale) ? locale : "zh-CN"]
}
