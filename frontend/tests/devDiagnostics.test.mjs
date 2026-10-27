import test from "node:test";
import assert from "node:assert/strict";
import { checkMarketData } from "../src/lib/devDiagnostics.ts";

const backend = "http://127.0.0.1:3001";
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

test("missing viewer JWT is explicitly diagnosed without sending any HTTP request", async () => {
  let called = false;
  const result = await checkMarketData("", backend, async () => {
    called = true;
    throw new Error("should not fetch");
  });
  assert.equal(result.code, "missing-token");
  assert.equal(called, false);
});

test("rejects external backend addresses before transmitting JWT", async () => {
  let called = false;
  const result = await checkMarketData("secret-value", "https://example.com", async () => {
    called = true;
    throw new Error("should not fetch");
  });
  assert.equal(result.code, "invalid-config");
  assert.equal(called, false);
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
});

test("handles expired viewer JWT (401)", async () => {
  const result = await checkMarketData("expired-token", backend, async () => json(401, { error: "Nope" }));
  assert.equal(result.code, "unauthorized");
});

test("distinguishes wrong port and wrong server", async () => {
  const wrongPort = await checkMarketData("jwt", backend, async () => new Response("Not Found", { status: 404 }));
  const wrongServer = await checkMarketData("jwt", backend, async () => new Response("<html>frontend</html>", { status: 200, headers: { "content-type": "text/html" } }));
  assert.equal(wrongPort.code, "invalid-config");
  assert.equal(wrongServer.code, "invalid-config");
});

test("responds with waiting status if backend returns no candles", async () => {
  const result = await checkMarketData("jwt", backend, async () => json(200, { success: true, data: [] }));
  assert.equal(result.code, "connected-empty");
  assert.equal(result.candleCount, 0);
});

test("classifies successful chart data without exposing token", async () => {
  let receivedAuthorization = "";
  const result = await checkMarketData("viewer-jwt", backend, async (url, init) => {
    receivedAuthorization = init.headers.Authorization;
    assert.match(url, /symbol=BTCUSDT/);
    return json(200, { success: true, data: [{ close: "100" }] });
  });
  assert.equal(receivedAuthorization, "Bearer viewer-jwt");
  assert.equal(result.code, "connected");
  assert.equal(result.candleCount, 1);
  assert.equal(JSON.stringify(result).includes("viewer-jwt"), false);
});

test("classifies connection refusal as backend offline", async () => {
  const result = await checkMarketData("jwt", backend, async () => { throw new Error("ECONNREFUSED"); });
  assert.equal(result.code, "backend-offline");
});
