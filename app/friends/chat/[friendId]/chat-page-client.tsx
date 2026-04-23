"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ChatPanel, useChatSession } from "@/components/friend-chat"

export function FriendChatPageClient({ friendId }: { friendId: string }) {
  const chat = useChatSession(friendId)

  return (
    <div className="mx-auto flex h-[calc(var(--app-viewport-height)-3rem)] max-w-[1000px] flex-col px-0 py-0 md:h-[calc(var(--app-viewport-height)-7rem)] md:px-6 md:py-6">
      <ChatPanel
        friend={chat.friend}
        messages={chat.messages}
        loading={chat.loading}
        sending={chat.sending}
        text={chat.text}
        files={chat.files}
        sendOriginal={chat.sendOriginal}
        onTextChange={chat.setText}
        onFilesChange={chat.setFiles}
        onSendOriginalChange={chat.setSendOriginal}
        onSend={chat.sendMessage}
        onReload={chat.loadMessages}
        onRetryMessage={chat.retryMessage}
        onDiscardMessage={chat.discardMessage}
        className="h-full rounded-none border-x-0 border-b-0 md:rounded-[--radius-lg] md:border"
        headerPrefix={
          <Link href="/friends" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[--color-bg-hover]" aria-label="返回好友">
            <ArrowLeft size={18} />
          </Link>
        }
      />
    </div>
  )
}
