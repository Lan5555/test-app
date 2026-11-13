const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, beforeEach } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Compile the actual service in isolation without loading app environment files.
const source = readFileSync(
  path.join(__dirname, "../src/app/votes/service.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
let service;
let context;
let calls;
let sessions;
beforeEach(() => {
  calls = [];
  sessions = new Map();
  context = {
    exports: {},
    Headers,
    FormData,
    AbortSignal,
    URL,
    Intl,
    Date,
    process: { env: { NEXT_PUBLIC_DATABASE_LINK: "https://api.example.test" } },
    sessionStorage: {
      getItem: (key) => sessions.get(key) || null,
      setItem: (key, value) => sessions.set(key, value),
      removeItem: (key) => sessions.delete(key),
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    },
  };
  vm.runInNewContext(compiled, context);
  service = context.exports;
});

test("image uploads use the voting token and browser-generated multipart headers", async () => {
  sessions.set(
    "adminSession",
    JSON.stringify({ type: "admin", token: "portal-token" }),
  );
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  const uploaded = {
    imageId: "image-1",
    url: "https://res.cloudinary.com/example/image/upload/cover.png",
    publicId: "voting/polls/cover",
    purpose: "POLL",
    width: 1200,
    height: 800,
    bytes: 8,
    format: "png",
  };
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: uploaded }),
    };
  };
  const file = new File(["png-data"], "cover.png", { type: "image/png" });
  const result = await service.votingService.uploadImage(file, "POLL");
  assert.equal(result.imageId, "image-1");
  assert.equal(calls[0].url, "https://api.example.test/votes/api/admin/images");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer voting-token",
  );
  assert.equal(calls[0].options.headers.has("Content-Type"), false);
  assert.equal(calls[0].options.headers.has("Idempotency-Key"), false);
  assert.equal(calls[0].options.body.get("purpose"), "POLL");
  assert.equal(calls[0].options.body.get("file").name, "cover.png");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test("invalid voting image files fail before any upload request", async () => {
  for (const file of [
    { type: "image/svg+xml", size: 100 },
    { type: "image/gif", size: 100 },
    { type: "image/png", size: 0 },
    { type: "image/jpeg", size: 5242881 },
  ]) {
    await assert.rejects(service.votingService.uploadImage(file, "POLL"));
  }
  service.validateVotingImage({ type: "image/webp", size: 5242880 });
  assert.equal(calls.length, 0);
});

test("uncertain image uploads are never automatically retried", async () => {
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    throw new TypeError("Network interrupted");
  };
  await assert.rejects(
    service.votingService.uploadImage(
      new File(["portrait"], "portrait.webp", { type: "image/webp" }),
      "CANDIDATE",
    ),
    /Network interrupted/,
  );
  assert.equal(calls.length, 1);
});

test("unconfirmed images and wrong-purpose upload receipts cannot become saved images", async () => {
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  for (const data of [
    {
      imageId: "image-1",
      url: "https://images.example.test/a.png",
      purpose: "CANDIDATE",
    },
    { imageId: "", url: "https://images.example.test/a.png", purpose: "POLL" },
    {
      imageId: "image-1",
      url: "http://images.example.test/a.png",
      purpose: "POLL",
    },
  ]) {
    context.fetch = async () => ({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data }),
    });
    await assert.rejects(
      service.votingService.uploadImage(
        new File(["image"], "cover.png", { type: "image/png" }),
        "POLL",
      ),
      /could not be confirmed/,
    );
  }
});

test("cover and portrait IDs are sent on creation without submitting image delivery metadata", async () => {
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  await service.votingService.createPoll({
    title: "Awards",
    imageId: "poll-cover-id",
  });
  await service.votingService.addCandidate("poll-1", {
    name: "Candidate",
    bio: "Biography",
    photoImageId: "portrait-id",
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    title: "Awards",
    imageId: "poll-cover-id",
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    name: "Candidate",
    bio: "Biography",
    photoImageId: "portrait-id",
  });
  assert.equal(
    calls[0].options.headers.get("Content-Type"),
    "application/json",
  );
});

test("voting admin calls use only the voting token when portal and student sessions exist", async () => {
  sessions.set("userSession", JSON.stringify({ token: "student-token" }));
  sessions.set(
    "adminSession",
    JSON.stringify({ type: "admin", token: "portal-token" }),
  );
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  await service.votingService.adminPolls();
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer voting-token",
  );
  assert.equal(calls[0].url, "https://api.example.test/votes/api/admin/polls");
});

test("missing or malformed admin session fails before the network request", async () => {
  sessions.set("userSession", JSON.stringify({ token: "student-token" }));
  await assert.rejects(
    service.votingService.adminPolls(),
    /sign in to voting administration/,
  );
  sessions.set("adminSession", JSON.stringify({ token: "portal-token" }));
  sessions.set("votingAdminSession", "{");
  await assert.rejects(
    service.votingService.adminPolls(),
    /sign in to voting administration/,
  );
  assert.equal(calls.length, 0);
});

test("public requests do not forward either session token and never cache totals", async () => {
  sessions.set(
    "adminSession",
    JSON.stringify({ type: "admin", token: "portal-token" }),
  );
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  await service.votingService.polls();
  assert.equal(calls[0].options.headers.has("Authorization"), false);
  assert.equal(calls[0].options.cache, "no-store");
});

test("uncertain checkout retries preserve the same key and exact charge inputs", async () => {
  const attempt = {
    key: "test-uuid",
    pollId: "poll-1",
    candidateId: "candidate-1",
    quantity: 10,
    email: "voter@example.test",
  };
  await service.votingService.checkout(attempt);
  await service.votingService.checkout(attempt);
  assert.equal(calls[0].options.headers.get("Idempotency-Key"), "test-uuid");
  assert.equal(calls[0].options.body, calls[1].options.body);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    pollId: "poll-1",
    candidateId: "candidate-1",
    quantity: 10,
    email: "voter@example.test",
  });
});

test("receipt capability is sent in a header and not in its URL", async () => {
  await service.votingService.receipt("purchase/1", "private-receipt-token");
  assert.equal(
    calls[0].options.headers.get("X-Vote-Receipt-Token"),
    "private-receipt-token",
  );
  assert.equal(calls[0].url.endsWith("/purchases/purchase%2F1"), true);
  assert.equal(calls[0].url.includes("private-receipt-token"), false);
});

test("HTTP and API errors cannot be treated as a successful payment", async () => {
  context.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ success: true, message: "Forbidden" }),
  });
  await assert.rejects(service.votingService.polls(), /Forbidden/);
  context.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: false, message: "Not verified" }),
  });
  await assert.rejects(service.votingService.polls(), /Not verified/);
  context.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => {
      throw new Error("HTML response");
    },
  });
  await assert.rejects(
    service.votingService.polls(),
    /Voting is not available yet/,
  );
});

test("only HTTPS checkout addresses without embedded credentials are accepted", () => {
  assert.equal(
    service.checkoutAddress("https://checkout.example.test/pay"),
    "https://checkout.example.test/pay",
  );
  for (const address of [
    "javascript:alert(1)",
    "http://checkout.example.test",
    "https://user:pass@checkout.example.test",
    "/relative",
  ]) {
    assert.throws(() => service.checkoutAddress(address));
  }
});

test("published status alone is insufficient: voting must be within the time window", () => {
  const time = Date.now();
  const poll = {
    status: "OPEN",
    opensAt: new Date(time - 60000).toISOString(),
    closesAt: new Date(time + 60000).toISOString(),
  };
  assert.equal(service.isPollOpen(poll), true);
  assert.equal(service.isPollOpen({ ...poll, status: "DRAFT" }), false);
  assert.equal(service.isPollOpen({ ...poll, status: "CLOSED" }), false);
  assert.equal(
    service.isPollOpen({ ...poll, closesAt: new Date(time - 1).toISOString() }),
    false,
  );
  assert.equal(
    service.isPollOpen({
      ...poll,
      opensAt: new Date(time + 60000).toISOString(),
    }),
    false,
  );
});

test("validation message arrays are readable and preserve the backend recovery code", async () => {
  context.fetch = async () => ({
    ok: false,
    status: 422,
    json: async () => ({
      success: false,
      message: ["Quantity must be an integer.", "Email must be valid."],
      data: null,
      code: "PURCHASE_NOT_CREATED",
    }),
  });
  await assert.rejects(
    service.votingService.checkout({
      key: "retry-key",
      pollId: "poll",
      candidateId: "candidate",
      quantity: 1,
      email: "invalid",
    }),
    (error) => {
      assert.equal(
        error.message,
        "Quantity must be an integer. Email must be valid.",
      );
      assert.equal(error.status, 422);
      assert.equal(error.code, "PURCHASE_NOT_CREATED");
      return true;
    },
  );
});

test("a configured trailing slash does not change the voting API path", async () => {
  context.process.env.NEXT_PUBLIC_DATABASE_LINK = "https://api.example.test/";
  await service.votingService.polls();
  assert.equal(calls[0].url, "https://api.example.test/votes/api/polls");
});

test("the implemented voting endpoints use the supplied methods and payloads", async () => {
  sessions.set(
    "adminSession",
    JSON.stringify({ type: "admin", token: "portal-token" }),
  );
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "voting-token" }),
  );
  await service.votingService.poll("student-awards");
  await service.votingService.adminPoll("poll-1");
  await service.votingService.createPoll({
    title: "Test poll",
    description: "Test",
    currency: "NGN",
    votePriceMinor: 10000,
    maxVotesPerPurchase: 1000,
    opensAt: "2026-12-01T08:00:00.000Z",
    closesAt: "2026-12-10T20:00:00.000Z",
    resultsVisible: true,
  });
  await service.votingService.addCandidate("poll-1", {
    name: "Test candidate",
    bio: "Test",
    photoUrl: null,
  });
  await service.votingService.setStatus("poll-1", "PUBLISHED");
  assert.deepEqual(
    calls.map((call) => [
      call.options.method || "GET",
      call.url.replace("https://api.example.test/votes/api", ""),
    ]),
    [
      ["GET", "/polls/student-awards"],
      ["GET", "/admin/polls/poll-1"],
      ["POST", "/admin/polls"],
      ["POST", "/admin/polls/poll-1/candidates"],
      ["POST", "/admin/polls/poll-1/status"],
    ],
  );
  assert.equal(JSON.parse(calls[2].options.body).votePriceMinor, 10000);
  assert.deepEqual(JSON.parse(calls[4].options.body), { status: "PUBLISHED" });
  assert.equal(
    calls.some((call) => call.url.includes("webhooks")),
    false,
  );
});

test("voting login preserves the exact password and does not forward stored tokens", async () => {
  sessions.set("adminSession", JSON.stringify({ token: "portal-token" }));
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "voting-admin", token: "old-voting-token" }),
  );
  await service.votingService.adminLogin(" fixture password ");
  assert.equal(calls[0].url, "https://api.example.test/votes/api/admin/login");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.has("Authorization"), false);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    password: " fixture password ",
  });
});

test("saving and clearing voting auth leaves portal and student sessions untouched", () => {
  sessions.set("adminSession", "portal-session");
  sessions.set("userSession", "student-session");
  service.saveVotingAdminSession({
    token: "voting-token",
    name: "Voting manager",
    email: "manager@example.test",
    password: "must-not-be-saved",
  });
  assert.equal(service.readVotingAdminSession().token, "voting-token");
  assert.equal(
    sessions.get("votingAdminSession").includes("must-not-be-saved"),
    false,
  );
  service.clearVotingAdminSession();
  assert.equal(service.readVotingAdminSession(), null);
  assert.equal(sessions.get("adminSession"), "portal-session");
  assert.equal(sessions.get("userSession"), "student-session");
  assert.throws(
    () => service.saveVotingAdminSession({ token: "  " }),
    /sign-in could not be completed/,
  );
});

test("portal admin sessions cannot authorize voting administration", async () => {
  sessions.set(
    "adminSession",
    JSON.stringify({ type: "admin", token: "portal-token" }),
  );
  sessions.set(
    "userSession",
    JSON.stringify({ type: "user", token: "student-token" }),
  );
  await assert.rejects(
    service.votingService.adminPolls(),
    /sign in to voting administration/,
  );
  sessions.set(
    "votingAdminSession",
    JSON.stringify({ type: "admin", token: "portal-token" }),
  );
  await assert.rejects(
    service.votingService.adminPolls(),
    /sign in to voting administration/,
  );
  assert.equal(calls.length, 0);
});
