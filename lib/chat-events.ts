import type { ChatMessagePayload } from "@/lib/chat"

type Subscriber = {
  userId: string
  send: (message: ChatMessagePayload) => void
}

const subscribers = new Set<Subscriber>()

export function subscribeChat(userId: string, send: Subscriber["send"]) {
  const subscriber = { userId, send }
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

export function publishChatMessage(message: ChatMessagePayload) {
  for (const subscriber of subscribers) {
    if (subscriber.userId === message.senderId || subscriber.userId === message.receiverId) {
      subscriber.send(message)
    }
  }
}
