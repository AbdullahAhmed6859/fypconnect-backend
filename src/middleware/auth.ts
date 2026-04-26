import { Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { verifyToken } from "../utils/jwt.js";

export const protect = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = req.cookies.auth_token ?? bearerToken;

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Token expired or invalid" });
  }

  const userId = Number(decoded.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ message: "Token expired or invalid" });
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
    return res.status(401).json({ message: "Account no longer exists" });
  }

  if (user.account_status === "blocked") {
    return res.status(403).json({ message: "Account is blocked" });
  }

  if (!user.verified || user.account_status === "pending") {
    return res.status(403).json({
      message: "Please verify your email before continuing",
      data: {
        email: user.email,
        verificationStatus: "pending",
      },
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
};
