/**
 * Tests for authentication flow: successful login, failed login, and user creation.
 *
 * Run with:
 *   pnpm test
 *
 * The tests use `convex-test` and the local Convex schema/modules loader.
 */

import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("Auth flow", () => {
  it("returns null when not authenticated", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.auth.getCurrentUser, {});
    expect(result).toBeNull();
  });

  it("throws when identity exists but no user in database", async () => {
    const t = convexTest(schema, modules);

    // Simulate an identity that has no corresponding user record
    const authedT = t.withIdentity({ subject: "missing_user_clerk" });

    await expect(authedT.query(api.auth.getCurrentUser, {})).rejects.toThrow();
  });

  it("creates a new user and returns current user on login (createOrUpdateUser + getCurrentUser)", async () => {
    const t = convexTest(schema, modules);

    const clerkId = "clerk_new_user_1";
    const createArgs = {
      clerkId,
      email: "new.user@example.com",
      firstName: "New",
      lastName: "User",
      // role is optional; rely on default ("student")
    };

    // Create the user via mutation
    const createdId = await t.mutation(api.auth.createOrUpdateUser, createArgs);
    expect(createdId).toBeDefined();
    expect(typeof createdId).toBe("string");

    // Now simulate authentication as that clerk identity and fetch current user
    const authedT = t.withIdentity({ subject: clerkId });
    const currentUser = await authedT.query(api.auth.getCurrentUser, {});

    expect(currentUser).not.toBeNull();
    expect(currentUser!.clerkId).toBe(clerkId);
    expect(currentUser!.email).toBe(createArgs.email);
    expect(currentUser!.firstName).toBe(createArgs.firstName);
    expect(currentUser!.lastName).toBe(createArgs.lastName);
  });

  it("updates an existing user when createOrUpdateUser is called again", async () => {
    const t = convexTest(schema, modules);

    const clerkId = "clerk_update_user_1";
    const initial = {
      clerkId,
      email: "update.user@example.com",
      firstName: "Initial",
      lastName: "Name",
      role: "student" as const,
    };

    const createdId = await t.mutation(api.auth.createOrUpdateUser, initial);
    expect(createdId).toBeDefined();

    // Update some fields
    const updated = {
      ...initial,
      firstName: "Updated",
      lastName: "NameUpdated",
    };

    const updatedId = await t.mutation(api.auth.createOrUpdateUser, updated);
    // Should return the same document id
    expect(updatedId).toBe(createdId);

    // Verify via authenticated query
    const authedT = t.withIdentity({ subject: clerkId });
    const currentUser = await authedT.query(api.auth.getCurrentUser, {});

    expect(currentUser).not.toBeNull();
    expect(currentUser!.firstName).toBe("Updated");
    expect(currentUser!.lastName).toBe("NameUpdated");
  });
});
