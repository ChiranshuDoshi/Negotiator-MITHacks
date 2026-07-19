import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/quotes/synthetic/route";
import { SyntheticQuoteBatchSchema } from "@/domain/schemas/person4";

import { makeGenerationInput } from "./factories";

const API_KEY = "synthetic-route-test-key";

function makeRequest(body: unknown, authorization = `Bearer ${API_KEY}`): Request {
  return new Request("http://localhost/api/quotes/synthetic", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/quotes/synthetic", () => {
  it("requires internal authorization", async () => {
    vi.stubEnv("POLICYSCOUT_INTERNAL_API_KEY", API_KEY);

    const response = await POST(makeRequest(makeGenerationInput(), "Bearer wrong-key"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("strictly parses input and returns the generated batch", async () => {
    vi.stubEnv("POLICYSCOUT_INTERNAL_API_KEY", API_KEY);
    const invalidResponse = await POST(makeRequest({ ...makeGenerationInput(), unexpected: true }));
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const response = await POST(makeRequest(makeGenerationInput()));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(SyntheticQuoteBatchSchema.parse(body)).toEqual(body);
  });
});
