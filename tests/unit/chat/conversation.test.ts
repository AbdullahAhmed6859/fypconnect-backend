import { normalizeSendMessageInput } from "../../../src/queries/conversation";

describe("message validation", () => {
  test("rejects an empty message", () => {
    expect(() =>
      normalizeSendMessageInput(1, 5, {
        content: "   ",
      }),
    ).toThrow("Message content cannot be empty");
  });

  test("rejects a message longer than 1000 characters", () => {
    expect(() =>
      normalizeSendMessageInput(1, 5, {
        content: "a".repeat(1001),
      }),
    ).toThrow("Message content exceeds 1000 characters");
  });

  test("rejects a non-text message payload", () => {
    expect(() =>
      normalizeSendMessageInput(1, 5, {
        content: { file: "notes.pdf" } as any,
      }),
    ).toThrow("Unsupported message type");
  });
});
