import { loginRateLimiter, loginFailureStore } from "../../../src/middleware/rateLimiter";

function createResponse(done: (result: { statusCode?: number; body?: unknown }) => void) {
  return {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    setHeader: jest.fn(),
    append: jest.fn(),
    removeHeader: jest.fn(),
    getHeader: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      done({ statusCode: this.statusCode, body: payload });
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      done({ statusCode: this.statusCode, body: payload });
      return this;
    },
  };
}

function runLimiter(email: string) {
  return new Promise<{ blocked: boolean; statusCode?: number; body?: unknown }>((resolve) => {
    const req: any = {
      body: { email },
      ip: "127.0.0.1",
      headers: {},
      app: { get: jest.fn() },
    };

    const res = createResponse((result) => {
      resolve({ blocked: true, ...result });
    });

    loginRateLimiter(req, res as any, () => {
      resolve({ blocked: false });
    });
  });
}

describe("login lockout", () => {
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    jest.setSystemTime(new Date("2026-05-01T00:00:00.000Z"));
    loginFailureStore.resetAll();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("locks the sixth failed login attempt", async () => {
    const email = "student@st.habib.edu.pk";

    for (let i = 0; i < 5; i++) {
      const result = await runLimiter(email);
      expect(result.blocked).toBe(false);
    }

    const sixthAttempt = await runLimiter(email);

    expect(sixthAttempt.blocked).toBe(true);
    expect(sixthAttempt.statusCode).toBe(423);
    expect(sixthAttempt.body).toEqual({
      status: 423,
      error: "Too many failed login attempts. Please try again in 30 minutes.",
    });
  });

  test("resets failed login attempts after 15 minutes", async () => {
    const email = "student@st.habib.edu.pk";

    for (let i = 0; i < 5; i++) {
      const result = await runLimiter(email);
      expect(result.blocked).toBe(false);
    }

    jest.advanceTimersByTime(16 * 60 * 1000);

    const nextAttempt = await runLimiter(email);
    expect(nextAttempt.blocked).toBe(false);
  });

  test("releases the login lock after 30 minutes", async () => {
    const email = "student@st.habib.edu.pk";

    for (let i = 0; i < 5; i++) {
      const result = await runLimiter(email);
      expect(result.blocked).toBe(false);
    }

    const sixthAttempt = await runLimiter(email);
    expect(sixthAttempt.blocked).toBe(true);

    jest.advanceTimersByTime(31 * 60 * 1000);

    const seventhAttempt = await runLimiter(email);
    expect(seventhAttempt.blocked).toBe(false);
  });
});
