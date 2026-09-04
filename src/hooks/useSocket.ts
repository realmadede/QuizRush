import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export interface SocketConfig {
  sessionId?: string | undefined;
  role?: "player" | "host" | "spectator" | undefined;
  playerId?: string | undefined;
  token?: string | undefined;
  userId?: string | undefined;
}

/** Subscribes to live game events (session phase changes, players joining, results). */
export function useSocket(config: SocketConfig, onEvent: () => void) {
  const onEventRef = useRef(onEvent);

  // Keep the latest callback without re-triggering the connection effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!config.sessionId || !config.role) return;

    // Use explicit path and options to ensure connection works across devices
    const socket = io(window.location.origin, {
      query: {
        sessionId: config.sessionId,
        role: config.role,
        playerId: config.playerId,
        token: config.token,
        userId: config.userId,
      },
    });

    socket.on("connect", () => {
      if (config.role === "player" && config.playerId && config.token) {
        socket.emit("join_session", {
          sessionId: config.sessionId,
          playerId: config.playerId,
          token: config.token,
        });
      } else if (config.role === "host" && config.userId) {
        socket.emit("join_host", {
          sessionId: config.sessionId,
          userId: config.userId,
        });
      } else if (config.role === "spectator") {
        socket.emit("join_spectator", {
          sessionId: config.sessionId,
        });
      }
    });

    const events = [
      "player_joined",
      "player_disconnected",
      "player_renamed",
      "answer_submitted",
      "session_updated",
    ];

    events.forEach((event) => {
      socket.on(event, () => {
        if (onEventRef.current) {
          onEventRef.current();
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [
    config.sessionId,
    config.role,
    config.playerId,
    config.token,
    config.userId,
  ]);
}
