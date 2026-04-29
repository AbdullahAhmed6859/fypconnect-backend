import { loginRateLimiter } from "../../../src/middleware/rateLimiter";

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
});
