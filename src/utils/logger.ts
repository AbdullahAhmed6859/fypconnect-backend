import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        // Changes [2026-04-05 18:43:36.798 +0500] to [18:43:36.798]
        translateTime: "HH:MM:ss.l",
      },
    },
  }),
});
