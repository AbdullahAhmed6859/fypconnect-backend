type AppErrorStatus = "fail" | "error";

class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: AppErrorStatus;
  public readonly isOperational: boolean;
  public readonly data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    if (data !== undefined) {
      this.data = data;
    }

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
