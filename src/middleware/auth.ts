import { Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { verifyToken } from "../utils/jwt.js";
import AppError from "../utils/appError.js";

export const protect = async (req: any, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    const token = req.cookies.auth_token ?? bearerToken;

    if (!token) {
      throw new AppError("Not authorized", 401);
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      throw new AppError("Token expired or invalid", 401);
    }

    const userId = Number(decoded.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("Token expired or invalid", 401);
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        email: true,
        verified: true,
        account_status: true,
      },
    });

    if (!user || user.account_status === "deleted") {
      throw new AppError("Account no longer exists", 401);
    }

    if (user.account_status === "blocked") {
      throw new AppError("Account is blocked", 403);
    }

    if (!user.verified || user.account_status === "pending") {
      throw new AppError("Please verify your email before continuing", 403, {
        email: user.email,
        verificationStatus: "pending",
      });
    }

    req.user = {
      ...decoded,
      user_id: user.user_id,
      email: user.email,
      verified: user.verified,
      account_status: user.account_status,
    };
    next();
  } catch (error) {
    next(error);
  }
};
