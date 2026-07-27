import { describe, expect, it } from "@voidzero-dev/vite-plus-test";
import {
  DEFAULT_WORKSPACE,
  WORKSPACES,
  getWorkspace,
  groupWorkspaces,
  resolveWorkspace,
} from "./config";

describe("workspaces", () => {
  it("every workspace offers at least one command strip", () => {
    for (const workspace of WORKSPACES) {
      expect(workspace.strips.length).toBeGreaterThan(0);
    }
  });

  it("workspace ids are unique", () => {
    const ids = WORKSPACES.map((workspace) => workspace.value);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a saved workspace as-is", () => {
    expect(resolveWorkspace("memory")).toEqual({ workspace: "memory" });
  });

  it("redirects retired tabs onto the strip that absorbed them", () => {
    // These used to be top-level tabs that silently discarded the open panel.
    expect(resolveWorkspace("hf")).toEqual({ workspace: "connect", strip: "hf" });
    expect(resolveWorkspace("actions")).toEqual({ workspace: "connect", strip: "shortcuts" });
    expect(resolveWorkspace("tools")).toEqual({ workspace: "connect", strip: "tools" });
  });

  it("falls back to the default workspace for unknown or missing ids", () => {
    expect(resolveWorkspace("nonsense").workspace).toBe(DEFAULT_WORKSPACE);
    expect(resolveWorkspace(null).workspace).toBe(DEFAULT_WORKSPACE);
    expect(getWorkspace("nonsense").value).toBe(WORKSPACES[0].value);
  });

  it("groups workspaces without reordering them", () => {
    const flattened = groupWorkspaces().flatMap((group) => group.workspaces);
    expect(flattened).toEqual(WORKSPACES);
  });
});
