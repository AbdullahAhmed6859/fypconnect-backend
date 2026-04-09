import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./db/prisma";
import { logger } from "./utils/logger.js";
import authRouter from "./routers/authRouter";
import scheduleUnverifiedUserDeletion from "./cronJob/deleteUnverified.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
scheduleUnverifiedUserDeletion();

const PORT = process.env.PORT || 5000;

app.use("/api/v1/auth", authRouter);

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
