import assert from "node:assert/strict";
import test from "node:test";
import { stopProcessTree } from "./process-tree.mjs";

test("stops the full Windows process tree", () => {
  const calls = [];
  const child = { pid: 42, kill: () => calls.push(["child.kill"]) };
  const terminator = { on: (event) => calls.push(["terminator.on", event]) };

  stopProcessTree(child, {
    platform: "win32",
    spawnProcess: (command, args, options) => {
      calls.push([command, args, options]);
      return terminator;
    },
  });

  assert.deepEqual(calls, [
    [
      "taskkill",
      ["/pid", "42", "/T", "/F"],
      { stdio: "ignore", windowsHide: true },
    ],
    ["terminator.on", "error"],
  ]);
});

test("falls back to the child signal on Unix", () => {
  const calls = [];
  const child = { pid: 42, kill: () => calls.push("child.kill") };

  stopProcessTree(child, { platform: "linux" });

  assert.deepEqual(calls, ["child.kill"]);
});
