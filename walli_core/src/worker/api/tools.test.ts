import { describe, expect, it } from "vitest";
import { toolsRoute } from "./tools";

const env = {
  API_TOKEN: "test-token",
} as Env;

describe("tools route", () => {
  it("rejects timestamp requests without the internal API token", async () => {
    const response = await toolsRoute.request("/api/tools/timestamp", {}, env);

    expect(response.status).toBe(403);
  });

  it("returns the current timestamp with the requested time zone", async () => {
    const response = await toolsRoute.request(
      "/api/tools/timestamp?timeZone=Asia%2FShanghai",
      {
        headers: {
          authorization: "Bearer test-token",
        },
      },
      env,
    );
    const body = await response.json() as {
      timestamp: number;
      unixSeconds: number;
      iso: string;
      timeZone: string;
      datetime: string;
    };

    expect(response.status).toBe(200);
    expect(body.timestamp).toBeGreaterThan(0);
    expect(body.unixSeconds).toBe(Math.floor(body.timestamp / 1000));
    expect(body.iso).toBe(new Date(body.timestamp).toISOString());
    expect(body.timeZone).toBe("Asia/Shanghai");
    expect(body.datetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("rejects invalid time zones", async () => {
    const response = await toolsRoute.request(
      "/api/tools/timestamp?timeZone=Nope%2FNowhere",
      {
        headers: {
          authorization: "Bearer test-token",
        },
      },
      env,
    );

    expect(response.status).toBe(400);
  });
});
