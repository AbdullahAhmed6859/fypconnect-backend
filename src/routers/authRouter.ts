import express from "express";
import {
  loginController,
  logoutController,
  protectedController,
  resendVerificationController,
  signupController,
  verifyEmailController,
} from "../controllers/authController";
import { protect } from "../middleware/auth";

const authRouter = express.Router();

authRouter.post("/register", signupController);
authRouter.post("/verify-email", verifyEmailController);
authRouter.post("/resend-verification", resendVerificationController);
authRouter.post("/login", loginController);
authRouter.post("/logout", logoutController);
authRouter.post("/test-protected", protect, protectedController);

export default authRouter;
