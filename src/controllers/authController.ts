import { Request, Response } from "express";
import handleResponse from "../utils/handleResponse";
import {
  resendVerificationEmailForUser,
  verifyEmailToken,
} from "../queries/emailVerification";
import { signup } from "../queries/signup";
import { sendVerificationEmail } from "../utils/sendVerificationEmail";
import { login } from "../queries/login";
import { createToken } from "../utils/jwt";

export async function resendVerificationController(req: any, res: any) {
  const { email } = req.body;

  try {
    await resendVerificationEmailForUser(email);
    return handleResponse(res, 200, "Verification email resent successfully");
  } catch (error: any) {
   return handleResponse(res, error.statusCode ?? 400, error.message);
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
          codeExpiresInHours: 24
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
        codeExpiresInHours: 24
      },
    );
  } catch (error: any) {
    return handleResponse(res, error.statusCode ?? 400, error.message);
  }
}

export async function verifyEmailController(req: any, res: any) {
  const { email, token } = req.body;
  try {
    const result = await verifyEmailToken(email, token);

    if (result.alreadyVerified) {
      return handleResponse(res, 200, "Email is already verified",
        {email: email,
         verificationStatus:"verified"
        }
      );
    }

    return handleResponse(res, 200, "Email verified successfully");
  } catch (error: any) {
    return handleResponse(res, error.statusCode ?? 400, error.message);
  }
}

export async function loginController(req: any, res: any) {
  const { email, password } = req.body;

  try {
    const user = await login(email, password);

    const token = await createToken({
      user_id: user.user_id,
      email: user.email,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return handleResponse(res, 200, "Login successful", {
      user: {
        user_id: user.user_id,
        email: user.email,
        verified: user.verified,
      },
    });
  } catch (error: any) {
    return handleResponse(res, error.statusCode ?? 401, error.message);
  }
}

export async function logoutController(req: any, res: any) {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return handleResponse(res, 200, "Logout successful");
}

export async function protectedController(req: any, res: any) {
  return handleResponse(res, 200, "You have accessed a protected route", {
    user: req.user,
  });
}
