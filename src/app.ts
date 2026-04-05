import "dotenv/config";
import express, { type Request, type Response } from "express";
import signupRouter from "./routers/signupRouter.js";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./db/prisma";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 3000;

app.use("/signup", signupRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from the typescript server!");
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Successfully connected to the database");

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database:");
    console.error(error);
    process.exit(1);
  }
}

startServer();
