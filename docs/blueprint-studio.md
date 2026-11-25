# Blueprint Studio

Blueprint Studio opens from the student portal at `/pages/blueprints`. Create a blank Blueprint or open Hello World from Examples. Connect **On Start → Print**, use **Compile** to validate the graph, and use **Run** to watch the program’s output. **Debug** pauses before the first action. On the canvas, drag between pins or select the source node and use **Properties → Connect pins**. Press Ctrl+S or use **Save** to send pending changes immediately.

Right-drag or middle-drag to pan the canvas. A stationary right-click opens the node picker.

## Integration plan and implementation

1. Use the Next.js App Router, React, the student portal navigation, and the existing `CoreService` student session. Load the visual editor and CodeMirror on their own routes.
2. Model pin-addressed graphs and shared value types in `src/features/blueprint/core`. Lower the node registry to structured IR with scope, flow, and dependency diagnostics.
3. Register the JavaScript adapter and run the same IR in a Web Worker. Add source mapping, execution tracing, breakpoints, stepping, and resource limits.
4. Add account-owned project storage to the existing NestJS backend. Register an additive PostgreSQL migration and protect writes with optimistic revisions.
5. Verify graph/compiler/runtime parity with Node tests, project ownership and migrations with NestJS and PGlite, and editor interaction in a browser.

The frontend module lives under `src/features/blueprint`. The backend module lives under `quiz-server/src/blueprint`. Deployment requires the Blueprint backend and database migration to be available before students open the workspace. The existing backend verifies the student JWT and looks up the student account before each project operation.

## Graphs, compiler, and language adapters

A `.lanbp` export is a versioned JSON document with a title, graphs, educational comment preference, and an optional assignment identifier. Each graph contains node instances with canvas positions, typed defaults and optional breakpoints. A wire stores both node identifiers and both pin identifiers, plus its execution or data kind. The first graph is Main. Additional graphs are functions with their own entry nodes and parameter lists.

The node registry defines pins, properties, documentation, and lowering handlers. The compiler validates the document and pins, resolves lexical bindings and function calls, and expands pure data dependencies where they are used. The execution outputs on a Branch, Sequence, or Loop own nested blocks. Put shared work on the owner’s **Next** pin and connect loop work through **Body**. Function parameters, function results, and retrieved array or object values have type `any` until explicitly converted.

To add a node that uses existing operations, register its metadata and lowering handler in `core/registry.ts`. Define a new IR operation only if the existing instructions and expressions cannot represent the node. When you add an operation, define its semantics and test the interpreter and both language adapters against the same graph.

The compiler’s output is a language-independent `Program` from `core/ir.ts`. A language adapter takes that structure and returns source, the file extension, and mappings to graph nodes. The JavaScript adapter constructs a Babel AST and uses Babel’s source mappings to connect emitted lines to the editor. The C++ adapter emits a standalone C++11 program from the same IR. Both adapters are registered with `LanguageRegistry`.

To export native code, choose **C++** from the editor’s export language menu and select **Export C++**. Compile the resulting file with `g++ -std=c++11 project.cpp -o project`. C++ export uses ASCII case conversion and whitespace trimming. Native number formatting and conversion can differ from JavaScript on edge cases.

## Runtime and debugging

The editor sends validated IR to a dedicated worker. The interpreter supports asynchronous Delay, nested scopes, scoped loop indices, function calls, cancellation and stepping. It reports status, source node locations, values and batched traces. The worker caps execution steps, loop iterations, recursion, execution time, output and value sizes. Those limits apply inside the Studio. Downloaded JavaScript runs according to the environment where the student runs it.

Registered instructions work with graph values and do not have network, filesystem or provider access. The worker interprets operations directly without evaluating generated source. Web Workers provide isolation from the editor’s UI thread. They are not a complete security sandbox.

## Persistence and deployment

In `quiz-server`, run the registered TypeORM migration with `npm.cmd run migration:run` using the deployment’s normal database configuration. For environments that apply reviewed SQL directly, the equivalent migration is `quiz-server/sql/blueprint-projects.sql`. Use the existing configured `JWT_SECRET` for student sign-in and set the frontend’s existing `NEXT_PUBLIC_DATABASE_LINK` to the deployed API. The display name is configurable through `NEXT_PUBLIC_BLUEPRINT_STUDIO_NAME`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/blueprints/api/projects` | List the signed-in student’s projects |
| GET | `/blueprints/api/projects/:id` | Open one owned project |
| POST | `/blueprints/api/projects` | Create with `id` and `project` |
| POST | `/blueprints/api/projects/:id` | Save with `revision` and `project` |
| DELETE | `/blueprints/api/projects/:id` | Delete with the current `revision` |

All routes use the existing student bearer token. Ownership is derived server-side. The database stores the graph JSON and its revision. The API accepts up to 50 projects per student and 80 KB per project. It returns a conflict when a stale revision would overwrite changes. The editor keeps an account-scoped draft on the current browser and supports recovery as a copy when a newer server revision exists. Export files contain the authored graph data, so avoid entering credentials as literal values.

## Assignments and current scope

Three introductory assignments check exact console output and, where appropriate, whether the required kind of node ran. Add more in `src/features/blueprint/education.ts` with an identifier, instructions, expected output and optional required node type. The project remembers its assignment. Checks run in the editor and serve as practice feedback. There is no instructor submission or grading workflow in this release.

The current release includes eight working examples, the core node library, JavaScript and C++ export, local draft recovery, and database-backed project CRUD. It covers arithmetic, comparison, boolean logic, strings, lists, objects, conversion, structured control flow, functions, HTTP endpoint graphs, and debugger nodes. Comment nodes annotate the canvas. The full node catalog, resizable comment groups, instructor tools and hosted endpoint deployment are later phases.

## HTTP and API nodes

Choose **+ Endpoint** to create a graph with **On HTTP Request** wired to **HTTP Response**. Select the entry node and set the method and path in Properties. The entry has Method, Path, and Body data outputs. Wire values into **HTTP Response** to choose what the endpoint sends back. Use **Test endpoint → Send request** to see the status and body in the console. **Debug request** pauses before the endpoint’s first action.

In any graph, **HTTP GET**, **POST**, **PUT**, **PATCH**, and **DELETE** accept relative paths and expose status and body outputs. The **Project** target calls endpoint graphs in the same project. The **Connected** target calls the HTTPS API base set by the app operator through `NEXT_PUBLIC_BLUEPRINT_HTTP_BASE_URL`. The connected API must allow the app’s origin through CORS. Student-session tokens and cookies are excluded from these requests, and redirects are blocked.

Export an endpoint graph to JavaScript and run the file with Node.js 22 or later using `node project.js --serve 3000`. The generated server listens on the local loopback interface and prints its address. Inside the editor, project endpoints run in the project’s worker.

## AI Automation

Open **AI Automation** or the editor’s **Settings** and connect your OpenAI API key. The editor’s **AI Automation** category contains **AI Summarize Text**, **AI Extract Action Items**, and **AI Explain JavaScript**. Connect an execution wire and a string input, then wire the output to another node such as Print. The first successful run validates the key. The connection follows you between Studio sections. Disconnect it, leave Studio, or reload to clear it.

The student-authenticated backend endpoint is `POST /blueprints/api/automation/run`. A run forwards the selected task’s text to the OpenAI Responses API over HTTPS. The key is kept in memory and is excluded from project files, source exports, and browser storage. The service allows six requests per account per minute and applies token, input, and time limits. It sends `store: false`. Set `BLUEPRINT_OPENAI_MODEL` in the backend if your deployment needs a model other than `gpt-4.1-mini`. [OpenAI Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create)

Graphs with HTTP or AI nodes export to JavaScript. Project-local HTTP works directly in the exported program. For Connected HTTP or AI nodes, supply a `globalThis.blueprintHost(request)` function in your own environment. The host receives the operation and input and returns either `{ status, body }` for HTTP or a string for AI.

## Verification

The Blueprint API integration suite covers student-token validation, project ownership and stale-write protection. Frontend regressions cover canvas measurement and selection updates, and native C++ exports are compiled and compared with the interpreter. Automation tests use provider fixtures. The broader lint and backend suites have reported failures in other modules, including legacy Jest import resolution and voting tests.

- Run `npm.cmd run test:blueprint` for the focused compiler/runtime suite and `node --test tests/*.test.cjs` for all frontend tests.
- Run `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand src/blueprint/blueprint.integration.spec.ts` in `quiz-server` to test ownership, tenant isolation, project validation, revisions and persistence.
- Run TypeScript, focused Biome checks and the normal Next.js production build. The build uses the portal’s existing Google Fonts downloads.
- For browser acceptance, sign into the student portal, create an example, run and step through it, edit a node, save, reopen it, and export both formats. Browser interaction and a live deployment remain to be verified.
