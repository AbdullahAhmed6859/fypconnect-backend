import { type Response } from "express";

type ApiResponse<T = unknown> = {
    success: boolean;
    message: string;
    data: T | null;
    };

    const handleResponse = <T>(
    res: Response,
    status: number,
    message: string,
    data?: T
    ): Response<ApiResponse<T>> => {
    return res.status(status).json({
        success: status >= 200 && status < 300,
        message,
        data: data ?? null,
    });
};

export default handleResponse;