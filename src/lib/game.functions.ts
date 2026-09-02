import { sessionAPI, playerAPI } from "@/lib/api-client";
import { z } from "zod";

const uuid = z.string().uuid();

export const createGameSession = async (quizId: string) => {
  return sessionAPI.create(quizId);
};

type HostAction =
  | "start_game"
  | "start_question"
  | "end_question"
  | "next_question"
  | "show_leaderboard"
  | "end_game";

export const hostAction = async (sessionId: string, action: HostAction) => {
  z.object({
    sessionId: uuid,
    action: z.enum([
      "start_game",
      "start_question",
      "end_question",
      "next_question",
      "show_leaderboard",
      "end_game",
    ]),
  }).parse({ sessionId, action });

  return sessionAPI.hostAction(sessionId, action);
};

export const joinGame = async (pin: string, nickname: string) => {
  z.object({
    pin: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "PIN must be 6 digits"),
    nickname: z
      .string()
      .trim()
      .min(1, "Enter a nickname")
      .max(20, "Max 20 characters"),
  }).parse({ pin, nickname });

  return sessionAPI.join(pin, nickname);
};

export const renamePlayer = async (
  playerId: string,
  token: string,
  nickname: string,
) => {
  return playerAPI.rename(playerId, token, nickname);
};

export const submitAnswer = async (
  playerId: string,
  token: string,
  answerId: string,
) => {
  return playerAPI.submitAnswer(playerId, token, answerId);
};

export const getGameState = async (sessionId: string) => {
  return sessionAPI.get(sessionId);
};

export const getPlayerState = async (playerId: string, token: string) => {
  return playerAPI.getState(playerId, token);
};
