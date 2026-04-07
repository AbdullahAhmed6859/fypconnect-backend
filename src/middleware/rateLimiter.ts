// import { rateLimit, Options } from 'express-rate-limit';

// export const createRateLimiter = (options: Partial<Options>) => {
//     return rateLimit({
//         windowMs: 60 * 60 * 1000,
//         limit: 3,
//         standardHeaders: 'draft-8',
//         legacyHeaders: false,
//         keyGenerator: (req) => {
//             return (req.headers['x-user-id'] as string) ?? req.ip;
//         },
//         ...options,
//     });
// };

import { rateLimit, Options, Store, IncrementResponse } from 'express-rate-limit';

interface AttemptRecord {
    count: number;
    resetTime: Date;
    isBlocked: boolean;
}

class LoginFailureStore implements Store {
    private readonly records = new Map<string, AttemptRecord>();
    private readonly COUNT_WINDOW_MS = 15 * 60 * 1000;
    private readonly BLOCK_DURATION_MS = 30 * 60 * 1000;

    async increment(key: string): Promise<IncrementResponse> {
        const now = Date.now();
        const existing = this.records.get(key);

        if (!existing || now >= existing.resetTime.getTime()) {
            const record: AttemptRecord = {
                count: 1,
                resetTime: new Date(now + this.COUNT_WINDOW_MS),
                isBlocked: false,
            };
            this.records.set(key, record);
            return { totalHits: record.count, resetTime: record.resetTime };
        }

        existing.count++;

        if (existing.count >= 5 && !existing.isBlocked) {
            existing.isBlocked = true;
            existing.resetTime = new Date(now + this.BLOCK_DURATION_MS);
        }

        return { totalHits: existing.count, resetTime: existing.resetTime };
    }

    async decrement(key: string): Promise<void> {
        const record = this.records.get(key);
        if (record && record.count > 0 && !record.isBlocked) {
            record.count--;
        }
    }

    async resetKey(key: string): Promise<void> {
        this.records.delete(key);
    }

    async resetAll(): Promise<void> {
        this.records.clear();
    }
}

export const createRateLimiter = (options: Partial<Options>) => {
    return rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 3,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        keyGenerator: (req) => (req.headers['x-user-id'] as string) ?? req.ip ?? 'unknown',
        ...options,
    });
};

export const loginRateLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new LoginFailureStore(),
    keyGenerator: (req) => (req.headers['x-user-id'] as string) ?? req.ip ?? 'unknown',
    message: {
        status: 429,
        error: 'Too many failed login attempts. Please try again in 30 minutes.',
    },
});