import assert from "node:assert/strict";
import { test } from "node:test";

test("extension loads against the pi 0.80.5 compat api", async () => {
	const extension = await import("./index.ts");
	const compat = await import("@earendil-works/pi-ai/compat");

	assert.equal(typeof extension.default, "function", "extension default export must be a function");
	assert.equal(typeof compat.complete, "function", "compat entrypoint must export a callable `complete`");
});
