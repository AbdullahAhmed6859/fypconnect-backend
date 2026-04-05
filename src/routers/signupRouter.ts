import express from 'express';
import { signupController } from '../controllers/signupController.js';
import { verifyEmailController } from "../controllers/verifyEmailController.js";
import { resendVerificationController } from "../controllers/resendVerificationController.js";

const signupRouter = express.Router();

signupRouter.post('/', signupController);
signupRouter.post("/verify-email", verifyEmailController);
signupRouter.post("/resend-verification", resendVerificationController);

export default signupRouter;