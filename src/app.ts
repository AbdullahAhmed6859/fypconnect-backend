import express, { type Request, type Response } from "express";
import signupRouter from "./routers/signupRouter.js";
import cors from "cors";

import signupRouter from "./routers/signupRouter.js";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/signup", signupRouter);


app.get("/", (req: Request, res: Response) => {
  res.send("Hello from the typescript server!");
});

app.use("/signup", signupRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

