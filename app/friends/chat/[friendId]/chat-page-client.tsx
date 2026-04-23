"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ChatPanel, useChatSession } from "@/components/friend-chat"

export function FriendChatPageClient({ userId, friendId }: { userId: string; friendId: string }) {
  const chat = useChatSession(friendId, undefined, undefined, userId)

  return (
    <div className="mx-auto flex h-[calc(var(--app-viewport-height)-3rem)] max-w-[1000px] flex-col px-0 py-0 md:h-[calc(var(--app-viewport-height)-8.5rem)] md:px-6 md:pb-6 md:pt-12">
      <ChatPanel
        friend={chat.friend}
        messages={chat.messages}
        loading={chat.loading}
        sending={chat.sending}
        text={chat.text}
        files={chat.files}
        sticker={chat.sticker}
        sendOriginal={chat.sendOriginal}
        onTextChange={chat.setText}
        onFilesChange={chat.setFiles}
        onStickerChange={chat.setSticker}
        onStickerPick={chat.pickSticker}
        onSendOriginalChange={chat.setSendOriginal}
        onSend={chat.sendMessage}
        onReload={chat.loadMessages}
        onRetryMessage={chat.retryMessage}
        onDiscardMessage={chat.discardMessage}
        userId={userId}
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
