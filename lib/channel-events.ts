import type { ChannelMessagePayload } from "@/lib/channel-chat"

type Subscriber = {
  channelId: string
  send: (message: ChannelMessagePayload) => void
}

const subscribers = new Set<Subscriber>()

export function subscribeChannel(channelId: string, send: Subscriber["send"]) {
  const subscriber = { channelId, send }
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

export function publishChannelMessage(message: ChannelMessagePayload) {
  for (const subscriber of subscribers) {
    if (subscriber.channelId === message.channelId) {
      subscriber.send(message)
    }
  }
}
