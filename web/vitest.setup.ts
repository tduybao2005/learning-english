import { afterEach } from "vitest";

// Testing-library only auto-cleans when a test framework's globals are on;
// this project runs vitest without `globals: true`, so nothing unmounted the
// previous test's tree. Rendered DOM then accumulated across tests in a file
// and a later `getByText` could match a node left over from an earlier test.
//
// Guarded on `document` because `setupFiles` also runs for the pure-logic
// suites, which use the default `node` environment and have no DOM.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
