import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./db/prisma";
import { logger } from "./utils/logger.js";
import authRouter from "./routers/authRouter";
import profileRouter from "./routers/profileRouter";
import matchesRouter from "./routers/matchesRouter.js";
import discoveryRouter from "./routers/discoveryRouter.js";
import browseRouter from "./routers/browseRouter.js";
import conversationRouter from "./routers/conversationRouter.js";
import scheduleUnverifiedUserDeletion from "./cronJob/deleteUnverified.js";
import cookieParser from "cookie-parser";
import { protect } from "./middleware/auth";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
scheduleUnverifiedUserDeletion();

const PORT = process.env.PORT || 5000;

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/profile", protect, profileRouter);
app.use("/api/v1/matches", protect, matchesRouter);
app.use("/api/v1/discovery", protect, discoveryRouter);
app.use("/api/v1/browse", protect, browseRouter);
app.use("/api/v1/chat", protect, conversationRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from the typescript server!");
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Successfully connected to the database");

    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database:");
    console.error(error);
    process.exit(1);
  }
}

startServer();
