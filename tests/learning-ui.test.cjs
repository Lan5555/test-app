const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

// Render actual presentation components without loading Next or app environment files.
const cache = new Map();
function loadComponent(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = module.paths;
  instance.require = (name) => {
    if (name.endsWith(".css")) return {};
    if (name.startsWith(".")) {
      for (const extension of [".tsx", ".ts"]) {
        const local = path.resolve(
          path.dirname(filename),
          `${name}${extension}`,
        );
        if (existsSync(local)) return loadComponent(local);
      }
    }
    return require(name);
  };
  cache.set(filename, instance);
  instance._compile(compiled, filename);
  return instance.exports;
}
const quiz = loadComponent(
  path.resolve(__dirname, "../src/app/components/study/quiz-views.tsx"),
);
const portal = loadComponent(
  path.resolve(__dirname, "../src/app/components/student/portal.tsx"),
);
const { authenticateStudent } = loadComponent(
  path.resolve(__dirname, "../src/app/helpers/student-auth.ts"),
);
const { default: StudentSignInView } = loadComponent(
  path.resolve(__dirname, "../src/app/components/student/sign-in-view.tsx"),
);
const { reviewFacts, reviewScore, answerStatus } = loadComponent(
  path.resolve(__dirname, "../src/app/components/reviews/model.ts"),
);
const { ReviewDetail, ReviewsOverview } = loadComponent(
  path.resolve(__dirname, "../src/app/components/reviews/review-views.tsx"),
);
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
const text = (html) => html.replace(/<[^>]+>/g, "");

const { VotingImage, CandidatePortrait } = loadComponent(
  path.resolve(__dirname, "../src/app/votes/image.tsx"),
);
const { default: VotingImageUpload } = loadComponent(
  path.resolve(__dirname, "../src/app/votes/image-upload.tsx"),
);
test("candidate portraits use saved public URLs and initials for missing or unsafe URLs", () => {
  const portrait = render(CandidatePortrait, {
    src: "https://res.cloudinary.com/example/image/upload/portrait.webp",
    name: "Ada Student",
  });
  assert.match(portrait, /alt="Portrait of Ada Student"/);
  assert.match(portrait, /loading="lazy"/);
  const fallback = render(CandidatePortrait, {
    src: null,
    name: "Ada Student",
  });
  assert.match(text(fallback), /AS/);
  assert.equal(fallback.includes("<img"), false);
  assert.equal(
    render(VotingImage, { src: "javascript:alert(1)", alt: "Cover" }).includes(
      "<img",
    ),
    false,
  );
});
test("voting upload pickers label optional image fields and accept only supported image formats", () => {
  for (const purpose of ["POLL", "CANDIDATE"]) {
    const html = render(VotingImageUpload, {
      purpose,
      value: null,
      onChange() {},
      onStatus() {},
      onAuthError() {},
    });
    assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/);
    assert.match(html, /type="file"/);
    assert.match(text(html), /Optional/);
    assert.match(text(html), /5 MiB/);
  }
});

const appearance = loadComponent(
  path.resolve(__dirname, "../src/app/components/appearance/model.ts"),
);
const { createAppTheme } = loadComponent(
  path.resolve(__dirname, "../src/app/components/appearance/theme.ts"),
);
const { ThemeControlView } = loadComponent(
  path.resolve(__dirname, "../src/app/components/appearance/provider.tsx"),
);

test("appearance accepts saved light and dark preferences and defaults invalid values to the device theme", () => {
  assert.equal(appearance.themePreference("dark"), "dark");
  assert.equal(appearance.themePreference("light"), "light");
  for (const value of [null, undefined, "system", "invalid", {}, "<script>"])
    assert.equal(appearance.themePreference(value), "system");
  assert.equal(appearance.themeMode("system", true), "dark");
  assert.equal(appearance.themeMode("system", false), "light");
  assert.equal(appearance.themeMode("light", true), "light");
  assert.equal(appearance.themeMode("dark", false), "dark");
});

test("the initial theme bootstrap restores explicit preferences before content is painted", () => {
  const vm = require("node:vm");
  for (const { saved, system, expected } of [
    { saved: "dark", system: false, expected: "dark" },
    { saved: "light", system: true, expected: "light" },
    { saved: null, system: true, expected: "dark" },
    { saved: "invalid", system: false, expected: "light" },
  ]) {
    const root = { dataset: {}, style: {} };
    vm.runInNewContext(appearance.themeBootstrap, {
      document: { documentElement: root },
      localStorage: {
        getItem: (key) => {
          assert.equal(key, "hub-theme");
          return saved;
        },
      },
      window: { matchMedia: () => ({ matches: system }) },
    });
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected);
  }
});

test("blocked preference storage falls back to the device theme without stopping the page", () => {
  const root = { dataset: {}, style: {} };
  require("node:vm").runInNewContext(appearance.themeBootstrap, {
    document: { documentElement: root },
    localStorage: {
      getItem() {
        throw new Error("Storage unavailable");
      },
    },
    window: { matchMedia: () => ({ matches: true }) },
  });
  assert.equal(root.dataset.theme, "dark");
});

test("both Material UI themes provide readable text and primary button contrast", () => {
  const { getContrastRatio } = require("@mui/material/styles");
  for (const mode of ["light", "dark"]) {
    const theme = createAppTheme(mode);
    assert.equal(theme.palette.mode, mode);
    assert.ok(
      getContrastRatio(
        theme.palette.text.primary,
        theme.palette.background.paper,
      ) >= 4.5,
    );
    assert.ok(
      getContrastRatio(
        theme.palette.text.secondary,
        theme.palette.background.paper,
      ) >= 4.5,
    );
    assert.ok(
      getContrastRatio(
        theme.palette.primary.contrastText,
        theme.palette.primary.main,
      ) >= 4.5,
    );
  }
  assert.notEqual(
    createAppTheme("light").palette.background.paper,
    createAppTheme("dark").palette.background.paper,
  );
  const dark = createAppTheme("dark");
  const disabled =
    dark.components.MuiInputBase.styleOverrides.input["&.Mui-disabled"]
      .WebkitTextFillColor;
  const helper = dark.components.MuiFormHelperText.styleOverrides.root.color;
  assert.ok(getContrastRatio(disabled, dark.palette.background.paper) >= 4.5);
  assert.ok(getContrastRatio(helper, dark.palette.background.paper) >= 4.5);
});

test("the global theme controls expose the current theme and an explicit device reset", () => {
  const html = render(ThemeControlView, {
    mode: "dark",
    preference: "system",
    onToggle() {},
    onSystem() {},
  });
  assert.match(html, /aria-label="Switch to light mode"/);
  assert.match(html, /aria-label="Follow device theme"/);
  assert.match(html, /aria-pressed="true"/);
});

const notifications = loadComponent(
  path.resolve(__dirname, "../src/app/components/notifications/model.ts"),
);
const { ToastCardView } = loadComponent(
  path.resolve(__dirname, "../src/app/components/notifications/toast-card.tsx"),
);
const recordsModel = loadComponent(
  path.resolve(__dirname, "../src/app/components/admin/records-model.ts"),
);
const { StudentRecordsView } = loadComponent(
  path.resolve(__dirname, "../src/app/components/admin/student-records.tsx"),
);

test("notification messages support validation arrays and ignore non-displayable objects", () => {
  assert.equal(
    notifications.toastMessage([" Check email ", null, "Try again"]),
    "Check email Try again",
  );
  assert.equal(notifications.toastMessage({ message: "private object" }), "");
  assert.equal(notifications.toastMessage("   "), "");
});
test("notification timing retains unread time across pauses and never becomes negative", () => {
  const remaining = notifications.remainingToastTime(4000, 1000, 2200);
  assert.equal(remaining, 2800);
  assert.equal(notifications.remainingToastTime(remaining, 10000, 11000), 1800);
  assert.equal(notifications.remainingToastTime(100, 0, 1000), 0);
  assert.equal(notifications.remainingToastTime(4000, 1000, 500), 4000);
  assert.equal(notifications.toastDuration("error", 0), 0);
  assert.ok(
    notifications.toastDuration("error") > notifications.toastDuration("info"),
  );
});
test("notification feedback is announced accessibly and errors include a labelled dismiss action", () => {
  const error = render(ToastCardView, {
    message: "Could not save this record.",
    type: "error",
    duration: 6500,
    onClose() {},
  });
  assert.match(error, /role="alert"/);
  assert.match(error, /aria-label="Dismiss error notification"/);
  const info = render(ToastCardView, {
    message: "<script>untrusted message</script>",
    type: "info",
    duration: 0,
    onClose() {},
  });
  assert.match(info, /role="status"/);
  assert.match(info, /&lt;script&gt;/);
  assert.equal(info.includes("hub-toast-track"), false);
});

const studentFixtures = [
  {
    id: 1,
    name: "Ada Student",
    email: "ada@example.test",
    score: 89.5,
    codeInfo: { code: "ADA-CODE", attempts: 2 },
  },
  {
    id: 2,
    name: "Bola Student",
    email: "bola@example.test",
    score: 0,
    codeInfo: { code: "", attempts: 0 },
  },
];
const recordsProps = {
  users: studentFixtures,
  filtered: studentFixtures,
  loading: false,
  error: "",
  search: "",
  scoreFilter: "all",
  sortBy: "score",
  sortOrder: "desc",
  view: "table",
  selected: new Set(),
  copiedId: null,
  busyId: null,
  page: 0,
  size: 10,
  onSearch() {},
  onFilter() {},
  onSort() {},
  onOrder() {},
  onView() {},
  onSelect() {},
  onSelectAll() {},
  onClear() {},
  onPage() {},
  onSize() {},
  onRefresh() {},
  onExport() {},
  onEdit() {},
  onDelete() {},
  onCopy() {},
};
test("student filtering searches trimmed names and includes decimal scores inside a range", () => {
  assert.deepEqual(
    recordsModel
      .filterStudentRecords(studentFixtures, " ADA ", "75-89", "score", "desc")
      .map((user) => user.id),
    [1],
  );
  assert.deepEqual(
    recordsModel
      .filterStudentRecords(studentFixtures, "", "0", "name", "asc")
      .map((user) => user.id),
    [2],
  );
  assert.deepEqual(
    studentFixtures.map((user) => user.id),
    [1, 2],
  );
});
test("selecting filtered students preserves unrelated selections and toggles only that filter", () => {
  const selected = new Set([1, 9]);
  assert.deepEqual(
    [...recordsModel.toggleFilteredSelection(selected, [1, 2])],
    [1, 9, 2],
  );
  assert.deepEqual(
    [...recordsModel.toggleFilteredSelection(new Set([1, 2, 9]), [1, 2])],
    [9],
  );
  assert.deepEqual([...selected], [1, 9]);
});
test("a shrinking student list clamps pagination to a populated page", () => {
  assert.deepEqual(recordsModel.recordPage(3, 4, 10), {
    page: 0,
    pages: 1,
    start: 1,
    end: 3,
    offset: 0,
  });
  assert.deepEqual(recordsModel.recordPage(0, 4, 10), {
    page: 0,
    pages: 1,
    start: 0,
    end: 0,
    offset: 0,
  });
});
test("the directory labels record actions by student name and supports both views with pagination", () => {
  const table = render(StudentRecordsView, recordsProps);
  assert.match(table, /aria-label="Edit Ada Student"/);
  assert.match(table, /aria-label="Copy access code for Ada Student"/);
  assert.match(table, /Unassigned/);
  assert.match(table, /89.5%/);
  const cards = render(StudentRecordsView, { ...recordsProps, view: "grid" });
  assert.match(cards, /records-student-card/);
  assert.match(cards, /aria-label="Next student page"/);
  assert.equal(table.includes("vs last month"), false);
});
test("directory failures retain last loaded records with explicit feedback", () => {
  const html = render(StudentRecordsView, {
    ...recordsProps,
    error: "Session expired.",
  });
  assert.match(html, /role="alert"/);
  assert.match(text(html), /Session expired/);
  assert.match(text(html), /last loaded records/);
  assert.match(text(html), /Ada Student/);
});
test("empty directories show a clear empty state and valid geometry", () => {
  const html = render(StudentRecordsView, {
    ...recordsProps,
    users: [],
    filtered: [],
  });
  assert.match(text(html), /Your directory is ready for students/);
  assert.equal(html.includes("NaN"), false);
  assert.equal(html.includes("Infinity"), false);
});

const { VotingAdminSignInForm } = loadComponent(
  path.resolve(__dirname, "../src/app/components/admin/voting-sign-in.tsx"),
);
test("voting sign-in explains separate credentials and retains accessible failure feedback", () => {
  const html = render(VotingAdminSignInForm, {
    password: "",
    showPassword: false,
    pending: false,
    error: "Incorrect voting password",
    onChange() {},
    onToggle() {},
    onSubmit() {},
  });
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="current-password"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Incorrect voting password/);
  assert.match(text(html), /regular portal login stays separate/);
  assert.match(html, /href="\/pages\/admin"/);
});
test("pending voting sign-in disables the password and submit controls", () => {
  const html = render(VotingAdminSignInForm, {
    password: "",
    showPassword: false,
    pending: true,
    error: "",
    onChange() {},
    onToggle() {},
    onSubmit() {},
  });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<input[^>]*disabled=""/);
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/);
  assert.match(text(html), /Signing in/);
});

test("saved review percentages are not divided by the question total again", () => {
  const facts = reviewFacts({ score: 80, totalQuestions: 20, review: [] });
  assert.equal(facts.score, 80);
  assert.equal(reviewScore(null), null);
  assert.equal(reviewScore(""), null);
});

test("missing answer keys never count as a correct saved answer", () => {
  assert.equal(
    answerStatus({ question: "Test", picked: "", correct: "" }),
    "unavailable",
  );
  assert.equal(
    answerStatus({ question: "Test", picked: "", correct: "A" }),
    "unanswered",
  );
  const facts = reviewFacts({
    score: 80,
    totalQuestions: 5,
    review: [{ question: "Test", picked: "A", correct: "A" }],
  });
  assert.equal(facts.correct, 1);
  assert.equal(facts.missing, 4);
});

test("review detail renders the recorded score and an accurate partial score ring", () => {
  const html = render(ReviewDetail, {
    review: {
      name: "Test assessment",
      score: 80,
      totalQuestions: 20,
      timeSpent: 2,
      completedDate: "2026-11-13T10:00:00Z",
      review: [],
    },
    onBack: () => {},
  });
  assert.match(html, /Recorded score 80%/);
  const offset = Number(html.match(/stroke-dashoffset="([^"]+)"/)[1]);
  assert.ok(Math.abs(offset - 2 * Math.PI * 44 * 0.2) < 0.001);
  assert.match(text(html), /20 questions do not have a saved question record/);
});

test("reviews overview distinguishes authorization failure from empty history", () => {
  const html = render(ReviewsOverview, {
    reviews: [],
    loading: false,
    error: "Access denied",
    onRetry: () => {},
    onSelect: () => {},
  });
  assert.match(html, /role="alert"/);
  assert.match(text(html), /Access denied/);
  assert.doesNotMatch(text(html), /Your completed assessments will appear/);
});

const signInProps = {
  email: "",
  code: "",
  showCode: false,
  loading: false,
  error: "",
  onEmailChange: () => {},
  onCodeChange: () => {},
  onToggleCode: () => {},
  onSubmit: () => {},
  onBack: () => {},
};

test("student sign-in uses a native form, labelled fields and a private access code", () => {
  const html = render(StudentSignInView, signInProps);
  assert.match(html, /<form/);
  assert.match(html, /for="portal-email"/);
  assert.match(html, /for="portal-code"/);
  assert.match(html, /type="password"/);
  assert.match(html, /aria-label="Show access code"/);
});

test("a failed sign-in has a persistent inline alert and pending sign-in disables submission", () => {
  const failed = render(StudentSignInView, {
    ...signInProps,
    error: "The supplied access code is invalid.",
  });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /The supplied access code is invalid/);
  const busy = render(StudentSignInView, { ...signInProps, loading: true });
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /type="submit"[^>]*disabled=""/);
});

test("student sign-in retains the server profile and assigned quiz in the session", async () => {
  let request;
  const service = {
    send: async (path, body) => {
      request = { path, body };
      return {
        success: true,
        message: "Signed in",
        data: {
          userId: 17,
          name: "Test Student",
          email: "test@example.invalid",
          quizId: 41,
          token: "test-only-token",
        },
      };
    },
  };
  const result = await authenticateStudent(
    " test@example.invalid ",
    " abc123 ",
    service,
  );
  assert.deepEqual(request, {
    path: "/users/api/login-student",
    body: { email: "test@example.invalid", code: "abc123" },
  });
  assert.equal(result.student.id, 17);
  assert.equal(result.session.name, "Test Student");
  assert.equal(result.session.quizId, 41);
  assert.equal(result.session.code, "ABC123");
});

test("rejected credentials or a missing token cannot produce a student session", async () => {
  await assert.rejects(
    authenticateStudent("test@example.invalid", "ABC123", {
      send: async () => ({
        success: false,
        message: "Invalid credentials",
        data: null,
      }),
    }),
    /Invalid credentials/,
  );
  await assert.rejects(
    authenticateStudent("test@example.invalid", "ABC123", {
      send: async () => ({ success: true, data: { userId: 17 } }),
    }),
    /Sign-in could not be completed/,
  );
});

test("an unassigned quiz is kept unassigned instead of defaulting to a fixed quiz", async () => {
  const result = await authenticateStudent("test@example.invalid", "ABC123", {
    send: async () => ({
      success: true,
      data: { userId: 17, name: "Test Student", token: "test-only-token" },
    }),
  });
  assert.equal(result.session.quizId, 0);
});

test("the first correct answer immediately displays 100 percent accuracy", () => {
  const output = text(
    render(quiz.QuizProgressPanel, {
      total: 5,
      current: 0,
      answered: true,
      correct: 1,
      streak: 1,
      history: [
        { question: "First", selected: 0, correct: true, correctAnswer: 0 },
      ],
    }),
  );
  assert.match(output, /Accuracy100%/);
  assert.match(output, /1 \/ 5/);
});

test("accuracy includes completed questions that timed out without an answer", () => {
  const output = text(
    render(quiz.QuizProgressPanel, {
      total: 5,
      current: 2,
      answered: false,
      correct: 1,
      streak: 0,
      history: [
        { question: "First", selected: 0, correct: true, correctAnswer: 0 },
      ],
    }),
  );
  assert.match(output, /Accuracy50%/);
  assert.match(output, /1 answer selected/);
});

test("the timer never renders invalid SVG geometry for a missing allowance", () => {
  const output = render(quiz.QuizTimer, { left: 0, total: 0 });
  assert.doesNotMatch(output, /NaN|Infinity/);
  assert.match(output, /role="timer"/);
});

test("a review authorization failure is shown as unavailable, rather than an empty history", () => {
  const student = {
    id: 1,
    name: "Test Student",
    email: "test@example.invalid",
    score: 75,
    time: 30,
    codeInfo: { attempts: "3" },
    activated: true,
    deadline: null,
  };
  const output = text(
    render(portal.PortalDashboard, {
      student,
      reviews: [],
      loading: false,
      error: "Reviews unavailable",
      search: "",
      onSearch: () => {},
      onRetry: () => {},
      onReveal: () => {},
      onShop: () => {},
    }),
  );
  assert.match(output, /Reviews unavailable/);
  assert.match(output, /Available attempts3/);
  assert.doesNotMatch(output, /Your completed assessments will appear/);
});

test("the shop summary uses returned prices and the selected quantity", () => {
  const output = text(
    render(portal.PortalShop, {
      products: [
        {
          id: 1,
          name: "Test item",
          price: 1250,
          icon: "",
          description: "Test description",
        },
      ],
      loading: false,
      error: "",
      onRetry: () => {},
      cart: { 1: 3 },
      onAdd: () => {},
      onRemove: () => {},
      onCheckout: () => {},
    }),
  );
  assert.match(output, /Total₦3,750\.00/);
});

test("a failed save cannot be presented as successfully recorded results", () => {
  const output = text(
    render(quiz.QuizResults, {
      title: "Test assessment",
      percentage: 50,
      correct: 1,
      incorrect: 0,
      unanswered: 1,
      saving: false,
      saveError: true,
      saved: true,
      onRestart: () => {},
      onPortal: () => {},
    }),
  );
  assert.match(output, /could not be fully saved/);
  assert.doesNotMatch(output, /Your score and responses have been saved/);
});
