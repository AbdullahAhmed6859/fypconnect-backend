import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export const protect = async (req: any, res: Response, next: NextFunction) => {
  const token = req.cookies.auth_token;
  console.log("Received token:", token);

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
