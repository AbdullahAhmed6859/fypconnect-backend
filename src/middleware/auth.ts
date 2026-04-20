import { Response, NextFunction } from "express";
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

  req.user = decoded;
  next();
};
