import { rateLimit, Options } from 'express-rate-limit';

export const createRateLimiter = (options: Partial<Options>) => {
    return rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 3,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        keyGenerator: (req) => {
            return (req.headers['x-user-id'] as string) ?? req.ip;
        },
        ...options,
    });
};
