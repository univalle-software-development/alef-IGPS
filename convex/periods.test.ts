/**
 * Vitest tests for the `periods` (admin) Convex functions.
 *
 * Covers:
 * - Creating periods (valid, invalid bimester, duplicate code)
 * - Updating period status (including marking as current and unmarking others)
 * - getAllPeriods filtering and sorting
 * - Comprehensive update via updatePeriod (mark current and update fields)
 * - Deleting periods (fails when sections exist, succeeds otherwise)
 *
 * Run with:
 *   pnpm test
 */

import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const now = Date.now();

const createAdminUser = async (t: any, subject: string) => {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: subject,
      email: `${subject}@example.com`,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      isActive: true,
      createdAt: Date.now(),
    });
  });
  return t.withIdentity({ subject });
};

describe("Period management (admin) Convex functions", () => {
  it("creates a period with valid data", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_create_period_1";
    const authedT = await createAdminUser(t, subject);

    const args = {
      code: "P2025B1",
      year: 2025,
      bimesterNumber: 1,
      nameEs: "Periodo 2025 Bimestre 1",
      nameEn: "2025 Period Bimester 1",
      startDate: now + 1000 * 60 * 60 * 24,
      endDate: now + 1000 * 60 * 60 * 24 * 30,
      enrollmentStart: now - 1000 * 60 * 60 * 24,
      enrollmentEnd: now + 1000 * 60 * 60 * 24 * 10,
      gradingDeadline: now + 1000 * 60 * 60 * 24 * 40,
    };

    const periodId = await authedT.mutation(api.admin.createPeriod, args);
    expect(periodId).toBeDefined();
    expect(typeof periodId).toBe("string");

    const periods = await authedT.query(api.admin.getAllPeriods, {});
    const created = periods.find((p: any) => p._id === periodId);
    expect(created).toBeDefined();
    expect(created.code).toBe(args.code);
    expect(created.year).toBe(args.year);
    expect(created.bimesterNumber).toBe(args.bimesterNumber);
  });

  it("rejects creation when bimesterNumber is out of range", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_create_period_invalid_bimester";
    const authedT = await createAdminUser(t, subject);

    const badArgs = {
      code: "BAD-BIM",
      year: 2025,
      bimesterNumber: 0, // invalid
      nameEs: "Bad Bimester",
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    };

    await expect(
      authedT.mutation(api.admin.createPeriod, badArgs),
    ).rejects.toThrow();
  });

  it("prevents duplicate period codes", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_create_period_duplicate";
    const authedT = await createAdminUser(t, subject);

    const args = {
      code: "DUP-2025",
      year: 2025,
      bimesterNumber: 2,
      nameEs: "Duplicated Period",
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    };

    const firstId = await authedT.mutation(api.admin.createPeriod, args);
    expect(firstId).toBeDefined();

    // Second attempt with same code should fail
    await expect(
      authedT.mutation(api.admin.createPeriod, args),
    ).rejects.toThrow();
  });

  it("updatePeriodStatus marks one period as current and unmarks others", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_update_period_status";
    const authedT = await createAdminUser(t, subject);

    // Create two periods
    const baseArgs = (codeSuffix: string) => ({
      code: `CURR-${codeSuffix}`,
      year: 2026,
      bimesterNumber: 1,
      nameEs: `Periodo ${codeSuffix}`,
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    });

    const id1 = await authedT.mutation(api.admin.createPeriod, baseArgs("A"));
    const id2 = await authedT.mutation(api.admin.createPeriod, baseArgs("B"));

    // Mark id1 as current
    await authedT.mutation(api.admin.updatePeriodStatus, {
      periodId: id1,
      status: "active",
      isCurrentPeriod: true,
    });

    let periods = await authedT.query(api.admin.getAllPeriods, {});
    const p1 = periods.find((p: any) => p._id === id1);
    const p2 = periods.find((p: any) => p._id === id2);
    expect(p1.isCurrentPeriod).toBe(true);
    expect(p2.isCurrentPeriod).toBe(false);

    // Now mark id2 as current via updatePeriodStatus; id1 should be unmarked
    await authedT.mutation(api.admin.updatePeriodStatus, {
      periodId: id2,
      status: "active",
      isCurrentPeriod: true,
    });

    periods = await authedT.query(api.admin.getAllPeriods, {});
    const p1After = periods.find((p: any) => p._id === id1);
    const p2After = periods.find((p: any) => p._id === id2);
    expect(p1After.isCurrentPeriod).toBe(false);
    expect(p2After.isCurrentPeriod).toBe(true);
  });

  it("getAllPeriods supports filtering by year, status, and searchTerm and sorts results", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_get_all_periods_filters";
    const authedT = await createAdminUser(t, subject);

    // Create multiple periods with different years and statuses
    const makeArgs = (
      code: string,
      year: number,
      bimester: number,
      status?: string,
    ) => ({
      code,
      year,
      bimesterNumber: bimester,
      nameEs: `Periodo ${code}`,
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    });

    const a = await authedT.mutation(
      api.admin.createPeriod,
      makeArgs("FILT1", 2024, 3),
    );
    const b = await authedT.mutation(
      api.admin.createPeriod,
      makeArgs("FILT2", 2025, 2),
    );
    const c = await authedT.mutation(
      api.admin.createPeriod,
      makeArgs("SEARCHME", 2025, 1),
    );

    // Update status of one period to 'active'
    await authedT.mutation(api.admin.updatePeriodStatus, {
      periodId: b,
      status: "active",
    });

    // Filter by year = 2025
    const byYear = await authedT.query(api.admin.getAllPeriods, { year: 2025 });
    expect(byYear.every((p: any) => p.year === 2025)).toBe(true);

    // Filter by status = active
    const byStatus = await authedT.query(api.admin.getAllPeriods, {
      status: "active",
    });
    expect(byStatus.length).toBeGreaterThanOrEqual(1);
    expect(byStatus.some((p: any) => p._id === b)).toBe(true);

    // SearchTerm should match code or nameEs (case-insensitive)
    const bySearch = await authedT.query(api.admin.getAllPeriods, {
      searchTerm: "search",
    });
    expect(bySearch.length).toBeGreaterThanOrEqual(1);
    expect(bySearch.some((p: any) => p._id === c)).toBe(true);

    // Ensure sorting: periods should be sorted desc by year then bimesterNumber
    const all = await authedT.query(api.admin.getAllPeriods, {});
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1];
      const cur = all[i];
      if (prev.year === cur.year) {
        expect(prev.bimesterNumber >= cur.bimesterNumber).toBe(true);
      } else {
        expect(prev.year >= cur.year).toBe(true);
      }
    }
  });

  it("updatePeriod performs comprehensive updates and unmarks other current periods when setting isCurrentPeriod", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_update_period";
    const authedT = await createAdminUser(t, subject);

    const args1 = {
      code: "UPD-A",
      year: 2027,
      bimesterNumber: 1,
      nameEs: "Original A",
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    };
    const args2 = {
      code: "UPD-B",
      year: 2027,
      bimesterNumber: 2,
      nameEs: "Original B",
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    };

    const id1 = await authedT.mutation(api.admin.createPeriod, args1);
    const id2 = await authedT.mutation(api.admin.createPeriod, args2);

    // Mark id1 as current
    await authedT.mutation(api.admin.updatePeriodStatus, {
      periodId: id1,
      status: "active",
      isCurrentPeriod: true,
    });

    // Now update id2 via updatePeriod and mark it as current as well
    await authedT.mutation(api.admin.updatePeriod, {
      periodId: id2,
      nameEs: "Updated B Name",
      nameEn: "Updated B Name EN",
      startDate: now + 10,
      endDate: now + 2000,
      enrollmentStart: now + 5,
      enrollmentEnd: now + 1500,
      addDropDeadline: undefined,
      withdrawalDeadline: undefined,
      gradingStart: undefined,
      gradingDeadline: now + 2500,
      status: "planning",
      isCurrentPeriod: true,
    });

    const periods = await authedT.query(api.admin.getAllPeriods, {});
    const p1 = periods.find((p: any) => p._id === id1);
    const p2 = periods.find((p: any) => p._id === id2);

    // id1 should be unmarked, id2 should be current
    expect(p1.isCurrentPeriod).toBe(false);
    expect(p2.isCurrentPeriod).toBe(true);
    expect(p2.nameEs).toBe("Updated B Name");
  });

  it("deletePeriod fails if there are sections associated with the period, succeeds otherwise", async () => {
    const t = convexTest(schema, modules);
    const subject = "admin_delete_period";
    const authedT = await createAdminUser(t, subject);

    // Create a period
    const periodId = await authedT.mutation(api.admin.createPeriod, {
      code: "DEL-P",
      year: 2028,
      bimesterNumber: 1,
      nameEs: "To be deleted",
      startDate: now,
      endDate: now + 1000,
      enrollmentStart: now,
      enrollmentEnd: now + 1000,
      gradingDeadline: now + 2000,
    });

    // Insert a valid course and professor, then a section tied to the period (simulate dependent data)
    await t.run(async (ctx: any) => {
      // Create a valid course (matches schema fields)
      const courseId = await ctx.db.insert("courses", {
        code: "COURSE-DEL-1",
        nameEs: "Curso para eliminar",
        descriptionEs: "Curso de prueba",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      // Create a valid professor user
      const professorId = await ctx.db.insert("users", {
        clerkId: `prof_clerk_${Math.random().toString(36).slice(2, 8)}`,
        email: `prof_${Math.random().toString(36).slice(2, 8)}@example.com`,
        firstName: "Prof",
        lastName: "Tester",
        role: "professor",
        isActive: true,
        createdAt: Date.now(),
        professorProfile: {
          employeeCode: "EMP-DEL-1",
        },
      });

      // Insert a section tied to the period using valid IDs
      await ctx.db.insert("sections", {
        courseId,
        periodId,
        professorId,
        groupNumber: "01",
        crn: "CRN-DEL-1",
        capacity: 30,
        enrolled: 0,
        deliveryMethod: "in_person",
        status: "active",
        gradesSubmitted: false,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    // Attempt to delete should throw
    await expect(
      authedT.mutation(api.admin.deletePeriod, { periodId }),
    ).rejects.toThrow();

    // Now remove the section and try again
    await t.run(async (ctx: any) => {
      // Delete all sections for that period
      const sections = await ctx.db
        .query("sections")
        .filter((q: any) => q.eq(q.field("periodId"), periodId))
        .collect();
      for (const s of sections) {
        await ctx.db.delete(s._id);
      }
    });

    const result = await authedT.mutation(api.admin.deletePeriod, { periodId });
    expect(result).toEqual({ success: true });

    // Confirm it's gone
    const all = await authedT.query(api.admin.getAllPeriods, {});
    expect(all.find((p: any) => p._id === periodId)).toBeUndefined();
  });
});
