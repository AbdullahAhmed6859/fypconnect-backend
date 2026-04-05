import express from "express";
import { signupController } from "../controllers/signupController";
import { verifyEmailController } from "../controllers/verifyEmailController";
import { resendVerificationController } from "../controllers/resendVerificationController";

const signupRouter = express.Router();

signupRouter.post("/", signupController);
signupRouter.post("/verify-email", verifyEmailController);
signupRouter.post("/resend-verification", resendVerificationController);

export default signupRouter;
