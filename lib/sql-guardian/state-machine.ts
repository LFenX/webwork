import {
  getContextLineKind,
  pickGuardianLine,
  type GuardianLineKind,
} from "@/lib/sql-guardian/dialogue-lines"
import type { GuardianEvent, GuardianRuntimeState, GuardianVisualState } from "@/lib/sql-guardian/types"

const FIRST_OPEN_LINE = "我在数据港口守着呢。需要我帮你看一眼 SQL 航线吗？"

export function createInitialGuardianState(isSqlLab: boolean, now = 0): GuardianRuntimeState {
  return {
    visualState: "idle",
    mood: isSqlLab ? "focused" : "curious",
    bubbleOpen: false,
    minimized: false,
    currentLine: FIRST_OPEN_LINE,
    lastInteractionAt: now,
    isSqlLab,
    lineCursor: 0,
  }
}

function nextLine(state: GuardianRuntimeState, kind: GuardianLineKind, eventLine?: string) {
  return eventLine ?? pickGuardianLine(kind, state.lineCursor)
}

function advanceLine(state: GuardianRuntimeState, patch: Partial<GuardianRuntimeState>): GuardianRuntimeState {
  return {
    ...state,
    ...patch,
    lineCursor: state.lineCursor + 1,
  }
}

function eventTime(state: GuardianRuntimeState, event: GuardianEvent) {
  return event.at ?? state.lastInteractionAt
}

export function reduceGuardianState(
  state: GuardianRuntimeState,
  event: GuardianEvent
): GuardianRuntimeState {
  const at = eventTime(state, event)

  switch (event.type) {
    case "WAKE":
      return advanceLine(state, {
        visualState: event.useTeleport ? "teleporting" : "talking",
        mood: state.isSqlLab ? "focused" : "curious",
        bubbleOpen: true,
        minimized: false,
        currentLine: nextLine(state, "wake", event.line),
        lastInteractionAt: at,
      })

    case "HOME_CLICKED":
      return advanceLine(state, {
        visualState: event.useTeleport ? "teleporting" : "talking",
        mood: "focused",
        bubbleOpen: true,
        minimized: false,
        isSqlLab: true,
        currentLine: nextLine(state, "sqlLab", event.line),
        lastInteractionAt: at,
      })

    case "SPRITE_CLICKED":
    case "OPEN_BUBBLE":
      return advanceLine(state, {
        visualState: "talking",
        mood: state.isSqlLab ? "focused" : "curious",
        bubbleOpen: true,
        minimized: false,
        currentLine: nextLine(state, getContextLineKind(state.isSqlLab), event.line),
        lastInteractionAt: at,
      })

    case "CLOSE_BUBBLE":
      return {
        ...state,
        visualState: state.minimized ? "hidden" : "idle",
        bubbleOpen: false,
        lastInteractionAt: at,
      }

    case "MINIMIZE":
      return {
        ...state,
        visualState: "hidden",
        bubbleOpen: false,
        minimized: true,
        lastInteractionAt: at,
      }

    case "RESTORE":
      return {
        ...state,
        visualState: "idle",
        minimized: false,
        lastInteractionAt: at,
      }

    case "USER_IDLE":
      if (state.minimized) return state
      return advanceLine(state, {
        visualState: "sleeping",
        mood: "sleepy",
        bubbleOpen: false,
        currentLine: nextLine(state, "sleeping", event.line),
        lastInteractionAt: at,
      })

    case "USER_ACTIVITY":
      if (state.visualState !== "sleeping") {
        return { ...state, lastInteractionAt: at }
      }
      return {
        ...state,
        visualState: "idle",
        mood: state.isSqlLab ? "focused" : "curious",
        lastInteractionAt: at,
      }

    case "ENTER_SQL_LAB":
      return advanceLine(state, {
        isSqlLab: true,
        mood: "focused",
        currentLine: nextLine(state, "sqlLab", event.line),
        lastInteractionAt: at,
      })

    case "LEAVE_SQL_LAB":
      return advanceLine(state, {
        isSqlLab: false,
        mood: "curious",
        currentLine: nextLine(state, "default", event.line),
        lastInteractionAt: at,
      })

    case "START_THINKING":
      return advanceLine(state, {
        visualState: "thinking",
        mood: "focused",
        bubbleOpen: true,
        minimized: false,
        currentLine: nextLine(state, "thinking", event.line),
        lastInteractionAt: at,
      })

    case "STOP_THINKING":
      return {
        ...state,
        visualState: state.minimized ? "hidden" : "idle",
        mood: state.isSqlLab ? "focused" : "calm",
        lastInteractionAt: at,
      }

    case "START_WALKING":
      if (state.minimized || state.bubbleOpen || state.visualState === "sleeping") return state
      return advanceLine(state, {
        visualState: "walking",
        mood: state.isSqlLab ? "focused" : "calm",
        currentLine: nextLine(state, "walking", event.line),
        lastInteractionAt: at,
      })

    case "BOUNDARY_BLOCKED":
      if (state.minimized) return state
      return advanceLine(state, {
        visualState: "jumping",
        currentLine: nextLine(state, "jumping", event.line),
        lastInteractionAt: at,
      })

    case "JUMP_COMPLETE":
      return {
        ...state,
        visualState: event.nextVisualState ?? "walking",
        lastInteractionAt: at,
      }

    case "TELEPORT":
      if (state.minimized) return state
      return advanceLine(state, {
        visualState: "teleporting",
        currentLine: nextLine(state, "teleporting", event.line),
        lastInteractionAt: at,
      })

    case "TELEPORT_COMPLETE": {
      const nextVisualState: GuardianVisualState = event.nextVisualState ?? "idle"
      return {
        ...state,
        visualState: state.minimized ? "hidden" : nextVisualState,
        lastInteractionAt: at,
      }
    }

    default:
      return state
  }
}
