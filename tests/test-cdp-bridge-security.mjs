import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, "extension", "firefox-cdp-bridge.js"), "utf8");
const listeners = new Map();
const sent = [];
const context = vm.createContext({
  browser: {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage(message) {
        sent.push(message);
        return Promise.resolve({ ok: true });
      },
    },
  },
  location: { origin: "https://example.test" },
  addEventListener(type, listener) { listeners.set(type, listener); },
});
context.window = context;

new vm.Script(source, { filename: "firefox-cdp-bridge.js" }).runInContext(context);
const onMessage = listeners.get("message");
const pageWindow = vm.runInContext("window", context);
assert.equal(typeof onMessage, "function");

onMessage({
  source: pageWindow,
  origin: "https://example.test",
  data: { source: "chatgpt-firefox-cdp", type: "binding", name: "registered", payload: "safe" },
});
assert.equal(sent.length, 1);
assert.equal(sent[0].name, "registered");
assert.equal(sent[0].payload, "safe");

for (const event of [
  { source: {}, origin: "https://example.test", data: { source: "chatgpt-firefox-cdp", type: "binding", name: "registered", payload: "forged" } },
  { source: pageWindow, origin: "https://attacker.test", data: { source: "chatgpt-firefox-cdp", type: "binding", name: "registered", payload: "forged" } },
  { source: pageWindow, origin: "https://example.test", data: { source: "chatgpt-firefox-cdp", type: "binding", name: "", payload: "forged" } },
  { source: pageWindow, origin: "https://example.test", data: { source: "chatgpt-firefox-cdp", type: "binding", name: "registered", payload: "x".repeat(1024 * 1024 + 1) } },
]) {
  onMessage(event);
}
assert.equal(sent.length, 1, "Cross-window, cross-origin, malformed, and oversized messages must be rejected.");

console.log(JSON.stringify({ ok: true, sameOriginBindingGate: true }, null, 2));
