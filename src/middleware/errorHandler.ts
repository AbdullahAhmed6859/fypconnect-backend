import type { NextFunction, Request, Response } from "express";
import AppError from "../utils/appError.js";
import handleResponse from "../utils/handleResponse.js";
import { logger } from "../utils/logger.js";
import { Prisma } from "../generated/prisma/client.js";

type NormalizedError = {
  statusCode: number;
  message: string;
  data?: unknown;
};

function normalizeError(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      data: err.data,
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { statusCode: 409, message: "Resource already exists" };
    }
    if (err.code === "P2025") {
      return { statusCode: 404, message: "Resource not found" };
    }
    if (err.code === "P2003") {
      return { statusCode: 400, message: "Invalid related resource" };
    }
    return { statusCode: 400, message: "Database request failed" };
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 400, message: "Invalid request payload" };
  }

  // express.json() body-parser SyntaxError
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as SyntaxError & { status?: number }).status === 400 &&
    "body" in err
  ) {
    return { statusCode: 400, message: "Invalid JSON payload" };
  }

  if (err && typeof err === "object") {
    const candidate = err as { statusCode?: unknown; message?: unknown };
    if (typeof candidate.statusCode === "number") {
      return {
        statusCode: candidate.statusCode,
        message: typeof candidate.message === "string"
          ? candidate.message
          : "Request failed",
      };
    }
  }

  return { statusCode: 500, message: "Internal server error" };
}

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(
    new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404)
  );
};

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const { statusCode, message, data } = normalizeError(err);

  if (statusCode >= 500) {
    logger.error(
      { err, path: req.originalUrl, method: req.method },
      "Unhandled server error"
    );
  } else {
    logger.warn(
      { statusCode, message, path: req.originalUrl, method: req.method },
      "Operational error"
    );
  }

  handleResponse(res, statusCode, message, data);
};
