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
  await resendVerificationEmailForUser(email);
  return handleResponse(res, 200, "Verification email resent successfully");
}

export async function signupController(req: any, res: any) {
  const { email, password } = req.body;
  const { newUser, rawToken } = await signup(email, password);

  const userPayload = {
    user_id: newUser.user_id,
    email: newUser.email,
    verified: newUser.verified,
    account_status: newUser.account_status,
    codeExpiresInHours: 24,
  };

  // The signup itself succeeded; surface a soft-failure when only the email
  // delivery step fails so the user can request a resend.
  try {
    await sendVerificationEmail(newUser.email, rawToken);
  } catch {
    return handleResponse(
      res,
      201,
      "User created, but verification email could not be sent. Please request a resend.",
      userPayload,
    );
  }

  return handleResponse(
    res,
    201,
    "User created successfully. Please check your email for your verification token",
    userPayload,
  );
}

export async function verifyEmailController(req: any, res: any) {
  const { email, token } = req.body;
  const result = await verifyEmailToken(email, token);

  if (result.alreadyVerified) {
    return handleResponse(res, 200, "Email is already verified", {
      email,
      verificationStatus: "verified",
    });
  }

  return handleResponse(res, 200, "Email verified successfully");
}

export async function loginController(req: any, res: any) {
  const { email, password } = req.body;
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
