import { Request, Response } from "express";
import handleResponse from "../utils/handleResponse";
import {
  resendVerificationEmailForUser,
  verifyEmailToken,
} from "../queries/emailVerification";
import { signup } from "../queries/signup";
import { sendVerificationEmail } from "../utils/sendVerificationEmail";

export async function resendVerificationController(req: any, res: any) {
  const { email } = req.body;

  try {
    await resendVerificationEmailForUser(email);
    return handleResponse(res, 200, "Verification email resent successfully");
  } catch (error: any) {
    return handleResponse(res, 400, error.message);
  }
}

export async function signupController(req: any, res: any) {
  const { email, password } = req.body;
  try {
    const { newUser, rawToken } = await signup(email, password);
    try {
      await sendVerificationEmail(newUser.email, rawToken);
    } catch (error) {
      return handleResponse(
        res,
        201,
        "User created, but verification email could not be sent. Please request a resend.",
        {
          user_id: newUser.user_id,
          email: newUser.email,
          verified: newUser.verified,
          account_status: newUser.account_status,
        },
      );
    }

    return handleResponse(
      res,
      201,
      "User created successfully. Please check your email for your verification token",
      {
        user_id: newUser.user_id,
        email: newUser.email,
        verified: newUser.verified,
        account_status: newUser.account_status,
      },
    );
  } catch (error: any) {
    return handleResponse(res, 400, error.message);
  }
}

export async function verifyEmailController(req: any, res: any) {
  const { email, token } = req.body;
  try {
    const result = await verifyEmailToken(email, token);

    if (result.alreadyVerified) {
      return handleResponse(res, 200, "Email is already verified");
    }

    return handleResponse(res, 200, "Email verified successfully");
  } catch (error: any) {
    return handleResponse(res, 400, error.message);
  }
}

export async function loginController(req: Request, res: Response) {
  handleResponse(res, 200, "Login controller is working!");
}
