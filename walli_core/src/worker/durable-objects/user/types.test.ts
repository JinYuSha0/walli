import { describe, expect, it } from "vitest";
import { createUserDoName, parseUserDoIdentity } from "./types";

describe("UserDO identity", () => {
  it("round-trips the client, platform, and full user ID", () => {
    expect(parseUserDoIdentity(createUserDoName("client-1", "telegram", "user:123")))
      .toEqual({ clientId: "client-1", type: "telegram", userId: "user:123" });
  });

  it("isolates clients on the same platform", () => {
    expect(createUserDoName("client-1", "web", "user-1"))
      .not.toBe(createUserDoName("client-2", "web", "user-1"));
  });

  it.each([undefined, "", "telegram:user-1", ":web:user", "client::user", "client:web:", "client:invalid:user"])(
    "rejects an incomplete or invalid identity: %s",
    (name) => expect(parseUserDoIdentity(name)).toBeNull(),
  );
});
