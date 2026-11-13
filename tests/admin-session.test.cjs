const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

test("portal API requests select the original admin session independently of student and voting sessions", async () => {
  const calls = [];
  const sessions = new Map([
    ["userSession", JSON.stringify({ token: "student-token" })],
    ["adminSession", JSON.stringify({ token: "portal-token" })],
    ["votingAdminSession", JSON.stringify({ token: "voting-token" })],
  ]);
  const context = {
    exports: {},
    window: {},
    process: { env: { NEXT_PUBLIC_DATABASE_LINK: "https://api.example.test" } },
    sessionStorage: { getItem: (key) => sessions.get(key) || null },
    require: (name) => {
      assert.equal(name, "./net-responses");
      return {
        NetResponse: class {
          constructor(data) {
            Object.assign(this, data);
          }
        },
      };
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    },
  };
  const compiled = ts.transpileModule(
    readFileSync(
      path.join(__dirname, "../src/app/helpers/api-handler.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  vm.runInNewContext(compiled, context);
  const { CoreService } = context.exports;
  await new CoreService("adminSession").get("/users/api/find-all-users");
  await new CoreService().get("/users/api/me");
  assert.equal(calls[0].options.headers.Authorization, "Bearer portal-token");
  assert.equal(calls[1].options.headers.Authorization, "Bearer student-token");
  sessions.delete("adminSession");
  await new CoreService("adminSession").get("/users/api/find-all-users");
  assert.equal(calls[2].options.headers.Authorization, undefined);
  sessions.set("adminSession", "{");
  await new CoreService("adminSession").get("/users/api/find-all-users");
  assert.equal(calls[3].options.headers.Authorization, undefined);
});
