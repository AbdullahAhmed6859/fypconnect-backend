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
import { createRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";

const authRouter = express.Router();
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 3 });
const verifyLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 3 });
const resendLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 3 });


authRouter.post("/register", registerLimiter, signupController);
authRouter.post("/verify-email", verifyLimiter, verifyEmailController);
authRouter.post("/resend-verification", resendLimiter, resendVerificationController);
authRouter.post("/login", loginRateLimiter, loginController);
authRouter.post("/logout", logoutController);
authRouter.post("/test-protected", protect, protectedController);

export default authRouter;
