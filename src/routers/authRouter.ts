import express from "express";
import {
  loginController,
  resendVerificationController,
  signupController,
  verifyEmailController,
} from "../controllers/authController";

const authRouter = express.Router();

authRouter.post("/register", signupController);
authRouter.post("/verify-email", verifyEmailController);
authRouter.post("/resend-verification", resendVerificationController);
authRouter.post("/login", loginController);

export default authRouter;
