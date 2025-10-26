/**
 * Vitest tests for the `programs` Convex functions.
 *
 * These tests cover the following scenarios:
 * 1. Creating a program with valid data (requires admin).
 * 2. Attempting to create a program with invalid data (no auth required).
 * 3. Editing a program and verifying that the changes are reflected (requires admin).
 * 4. Deleting a program (requires admin).
 * 5. Retrieving all programs to simulate display in a table (requires admin).
 *
 * Run the tests:
 * pnpm test
 */

import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";
import { modules } from "./test.setup";

// Helper function to create a program with default values for tests
const createDefaultProgram = (
  t: any,
  overrides: Partial<{
    code: string;
    nameEs: string;
    nameEn: string;
    descriptionEs: string;
    totalCredits: number;
    durationBimesters: number;
  }> = {},
) => {
  const defaults = {
    code: "CS101",
    nameEs: "Ciencia de la Computación",
    nameEn: "Computer Science",
    descriptionEs: "Programa de prueba de Ciencia de la Computación",
    type: "bachelor" as const,
    language: "es" as const,
    totalCredits: 160,
    durationBimesters: 8,
  };
  return t.mutation(api.programs.createProgram, { ...defaults, ...overrides });
};

describe("Program Mutations and Queries", () => {
  it("should create a program with valid data", async () => {
    const t = convexTest(schema, modules);

    // Insert an admin user into the mock DB and run as that identity
    const subject = "admin_create_program";
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: subject,
        email: "admin-create@example.com",
        firstName: "Admin",
        lastName: "Creator",
        role: "admin",
        isActive: true,
        createdAt: Date.now(),
      });
    });
    const authedT = t.withIdentity({ subject });

    const programData = {
      code: "ENG202",
      nameEs: "Ingeniería de Software",
      nameEn: "Software Engineering",
      descriptionEs: "Programa de prueba de Ingeniería de Software",
      type: "master" as const,
      language: "en" as const,
      totalCredits: 120,
      durationBimesters: 4,
    };

    // Create the program
    const programId = await authedT.mutation(
      api.programs.createProgram,
      programData,
    );

    // Assert that a valid ID was returned
    expect(programId).toBeDefined();
    expect(typeof programId).toBe("string");

    // Verify the program was saved correctly by querying the database
    const allPrograms = await authedT.query(api.programs.getAllPrograms, {});
    const newProgram = allPrograms.find((p: any) => p._id === programId);

    expect(newProgram).toBeDefined();
    expect(newProgram).toEqual(expect.objectContaining(programData));
  });

  it("should fail to create a program with invalid data (e.g., missing 'code')", async () => {
    // This test validates schema/argument checking and does not require admin identity.
    const t = convexTest(schema, modules);
    const invalidProgramData = {
      // 'code' is missing
      nameEs: "Programa Inválido",
      nameEn: "Invalid Program",
      descriptionEs: "Programa de prueba inválido",
      type: "bachelor" as const,
      language: "es" as const,
      totalCredits: 160,
      durationBimesters: 8,
    };

    // Expect the mutation to throw an error because of the validation
    await expect(
      t.mutation(api.programs.createProgram, invalidProgramData as any),
    ).rejects.toThrow();
  });

  it("should update an existing program and verify the changes", async () => {
    const t = convexTest(schema, modules);

    // Insert an admin user and run as that identity
    const subject = "admin_update_program";
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: subject,
        email: "admin-update@example.com",
        firstName: "Admin",
        lastName: "Updater",
        role: "admin",
        isActive: true,
        createdAt: Date.now(),
      });
    });
    const authedT = t.withIdentity({ subject });

    // 1. Create an initial program
    const programId = await createDefaultProgram(authedT, {
      code: "BIO100",
      nameEs: "Biología Original",
    });
    expect(programId).toBeDefined();

    // 2. Define the updates
    const updates = {
      programId: programId as Id<"programs">,
      nameEs: "Biología Actualizada",
      descriptionEs: "Descripción actualizada",
      language: "both" as const,
      isActive: false,
    };

    // 3. Run the update mutation
    await authedT.mutation(api.programs.updateProgram, updates);

    // 4. Retrieve the program and verify the changes
    const updatedProgram = await authedT.query(api.programs.getProgramDetails, {
      programId,
    });

    expect(updatedProgram).toBeDefined();
    // Note: getProgramDetails returns a composite object; the actual program is inside `.program`
    expect(updatedProgram?.program.nameEs).toBe(updates.nameEs);
    // totalCredits should remain unchanged from the default creation
    expect(updatedProgram?.program.totalCredits).toBe(160);
    expect(updatedProgram?.program.code).toBe("BIO100");
  });

  it("should delete a program", async () => {
    const t = convexTest(schema, modules);

    // Insert an admin user and run as that identity
    const subject = "admin_delete_program";
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: subject,
        email: "admin-delete@example.com",
        firstName: "Admin",
        lastName: "Deleter",
        role: "admin",
        isActive: true,
        createdAt: Date.now(),
      });
    });
    const authedT = t.withIdentity({ subject });

    // 1. Create two programs
    const programIdToDelete = await createDefaultProgram(authedT, {
      code: "DEL101",
    });
    const programIdToKeep = await createDefaultProgram(authedT, {
      code: "KEEP202",
    });

    // 2. Delete one of them
    await authedT.mutation(api.programs.deleteProgram, {
      programId: programIdToDelete,
    });

    // 3. Query all programs and verify deletion
    const allPrograms = await authedT.query(api.programs.getAllPrograms, {});

    expect(allPrograms.length).toBe(1);
    expect(allPrograms[0]._id).toBe(programIdToKeep);
    expect(
      allPrograms.find((p: any) => p._id === programIdToDelete),
    ).toBeUndefined();
  });

  it("should correctly retrieve a list of all programs for table display", async () => {
    const t = convexTest(schema, modules);

    // Insert an admin user and run as that identity
    const subject = "admin_list_programs";
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: subject,
        email: "admin-list@example.com",
        firstName: "Admin",
        lastName: "Lister",
        role: "admin",
        isActive: true,
        createdAt: Date.now(),
      });
    });
    const authedT = t.withIdentity({ subject });

    // 1. Create multiple programs
    await createDefaultProgram(authedT, {
      code: "PROG1",
      nameEs: "Programa Uno",
    });
    await createDefaultProgram(authedT, {
      code: "PROG2",
      nameEs: "Programa Dos",
    });

    // 2. Fetch all programs
    const programs = await authedT.query(api.programs.getAllPrograms, {});

    // 3. Verify the results
    expect(programs.length).toBe(2);
    expect(programs.map((p: any) => p.code).sort()).toEqual(["PROG1", "PROG2"]);
  });
});
