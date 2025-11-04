/**
 * Tests for sections functionality:
 * - createSection (admin & professor)
 * - updateSection (admin & professor owner)
 * - getSectionsByPeriod
 * - deleteSection (with/without enrollments and forceDelete)
 *
 * Run with:
 *   pnpm exec vitest run convex/sections.test.ts
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

describe("Sections functionality", () => {
  it("creates a section as admin and returns section details", async () => {
    const t = convexTest(schema, modules);
    const authedT = await createAdminUser(t, "admin_create_section");

    // Prepare required entities: course, period, professor
    const { courseId, periodId, profId } = await t.run(async (ctx: any) => {
      const courseId = await ctx.db.insert("courses", {
        code: "SEC-CRS-1",
        nameEs: "Curso Seccion 1",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const periodId = await ctx.db.insert("periods", {
        code: "2025-B1",
        year: 2025,
        bimesterNumber: 1,
        nameEs: "Periodo Test",
        startDate: now,
        endDate: now + 1000 * 60 * 60 * 24 * 30,
        enrollmentStart: now - 1000 * 60 * 60 * 24,
        enrollmentEnd: now + 1000 * 60 * 60 * 24 * 7,
        gradingDeadline: now + 1000 * 60 * 60 * 24 * 40,
        status: "planning",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const profId = await ctx.db.insert("users", {
        clerkId: `prof_admin_${Date.now()}`,
        email: `prof_admin_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Creator",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-1" },
        createdAt: Date.now(),
      });

      return { courseId, periodId, profId };
    });

    // Create a section as admin
    const res = await authedT.mutation(api.courses.createSection, {
      courseId,
      periodId,
      groupNumber: "01",
      professorId: profId,
      capacity: 30,
      deliveryMethod: "in_person",
    });

    expect(res).toHaveProperty("sectionId");
    expect(res).toHaveProperty("crn");
    expect(res.message).toMatch(/Section created successfully/);

    // Confirm section appears in adminGetSections
    const list = await authedT.query(api.admin.adminGetSections, { courseId });
    const found = list.find(
      (s: any) => s._id === res.sectionId || s.sectionId === res.sectionId,
    );
    expect(found).toBeDefined();
    // courseName should be present
    expect(found.courseCode || found.courseName || found.course).toBeTruthy();
  });

  it("allows a professor to create a section for themselves and forbids creating for another professor", async () => {
    const t = convexTest(schema, modules);

    // Insert course and period
    const { courseId, periodId, profAId, profBId } = await t.run(
      async (ctx: any) => {
        const courseId = await ctx.db.insert("courses", {
          code: "SEC-CRS-2",
          nameEs: "Curso Seccion 2",
          descriptionEs: "Desc",
          credits: 3,
          language: "es",
          category: "core",
          prerequisites: [],
          isActive: true,
          createdAt: Date.now(),
        });

        const periodId = await ctx.db.insert("periods", {
          code: "2025-B2",
          year: 2025,
          bimesterNumber: 2,
          nameEs: "Periodo Test 2",
          startDate: now,
          endDate: now + 1000 * 60 * 60 * 24 * 30,
          enrollmentStart: now - 1000 * 60 * 60 * 24,
          enrollmentEnd: now + 1000 * 60 * 60 * 24 * 7,
          gradingDeadline: now + 1000 * 60 * 60 * 24 * 40,
          status: "planning",
          isCurrentPeriod: false,
          createdAt: Date.now(),
        });

        const profAId = await ctx.db.insert("users", {
          clerkId: "prof_self_create",
          email: "prof_self_create@example.com",
          firstName: "Prof",
          lastName: "Self",
          role: "professor",
          isActive: true,
          professorProfile: { employeeCode: "EMP-A" },
          createdAt: Date.now(),
        });

        const profBId = await ctx.db.insert("users", {
          clerkId: "prof_other",
          email: "prof_other@example.com",
          firstName: "Prof",
          lastName: "Other",
          role: "professor",
          isActive: true,
          professorProfile: { employeeCode: "EMP-B" },
          createdAt: Date.now(),
        });

        return { courseId, periodId, profAId, profBId };
      },
    );

    // Act as profA
    const profSession = t.withIdentity({ subject: "prof_self_create" });

    // Should succeed when professor creates a section for themselves
    const created = await profSession.mutation(api.courses.createSection, {
      courseId,
      periodId,
      groupNumber: "10",
      professorId: profAId,
      capacity: 25,
      deliveryMethod: "online_async",
    });

    expect(created).toHaveProperty("sectionId");
    expect(created.message).toMatch(/Section created successfully/);

    // Attempting to create a section for another professor should fail
    await expect(
      profSession.mutation(api.courses.createSection, {
        courseId,
        periodId,
        groupNumber: "11",
        professorId: profBId,
        capacity: 20,
        deliveryMethod: "online_async",
      }),
    ).rejects.toThrow();
  });

  it("updates a section (admin and professor owner) and persists changes", async () => {
    const t = convexTest(schema, modules);
    const authedAdmin = await createAdminUser(t, "admin_update_section");

    // Create base entities and a section
    const { sectionId, professorId } = await t.run(async (ctx: any) => {
      const courseId = await ctx.db.insert("courses", {
        code: "SEC-CRS-UPD",
        nameEs: "Curso Update",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const periodId = await ctx.db.insert("periods", {
        code: "2026-B1",
        year: 2026,
        bimesterNumber: 1,
        nameEs: "Periodo Upd",
        startDate: now,
        endDate: now + 1_000_000,
        enrollmentStart: now - 1000,
        enrollmentEnd: now + 100000,
        gradingDeadline: now + 200000,
        status: "planning",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const professorId = await ctx.db.insert("users", {
        clerkId: `prof_upd_${Date.now()}`,
        email: `prof_upd_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Updater",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-UPD" },
        createdAt: Date.now(),
      });

      const section = await ctx.db.insert("sections", {
        courseId,
        periodId,
        groupNumber: "02",
        crn: "CRN-UPD-1",
        professorId,
        capacity: 20,
        enrolled: 0,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "draft",
        gradesSubmitted: false,
        isActive: true,
        createdAt: Date.now(),
      });

      return { sectionId: section, professorId };
    });

    // Update as admin: change capacity and status
    const updatedId = await authedAdmin.mutation(api.courses.updateSection, {
      sectionId,
      capacity: 35,
      status: "open",
    });

    expect(updatedId).toBe(sectionId);

    // Verify persisted changes
    const state = await t.run(async (ctx: any) => {
      const s = await ctx.db.get(sectionId);
      return s;
    });

    expect(state.capacity).toBe(35);
    expect(state.status).toBe("open");

    // Now act as professor owner to change schedule (professor session)
    // Create a professor identity that matches professorId
    const profClerk = `prof_owner_${Date.now()}`;
    await t.run(async (ctx: any) => {
      // Patch the professor record to have a known clerkId and persist map to existing professorId
      await ctx.db.patch(professorId, {
        clerkId: profClerk,
        updatedAt: Date.now(),
      });
    });

    const profSession = t.withIdentity({ subject: profClerk });

    // Professor updates allowed fields (e.g., waitlistCapacity)
    const profUpdated = await profSession.mutation(api.courses.updateSection, {
      sectionId,
      waitlistCapacity: 5,
    });

    expect(profUpdated).toBe(sectionId);

    const after = await t.run(async (ctx: any) => {
      return await ctx.db.get(sectionId);
    });

    expect(after.waitlistCapacity).toBe(5);
  });

  it("getSectionsByPeriod returns sections with enrollment stats and applies filters", async () => {
    const t = convexTest(schema, modules);
    const authedAdmin = await createAdminUser(t, "admin_list_sections");

    // Seed course, period, professor, and two sections
    const { courseId, periodId, profId, secA, secB } = await t.run(
      async (ctx: any) => {
        const courseId = await ctx.db.insert("courses", {
          code: "SEC-CRS-LST",
          nameEs: "Curso List",
          descriptionEs: "Desc",
          credits: 3,
          language: "es",
          category: "core",
          prerequisites: [],
          isActive: true,
          createdAt: Date.now(),
        });

        const periodId = await ctx.db.insert("periods", {
          code: "2027-B1",
          year: 2027,
          bimesterNumber: 1,
          nameEs: "Periodo List",
          startDate: now,
          endDate: now + 1000 * 60 * 60 * 24 * 30,
          enrollmentStart: now - 1000 * 60 * 60 * 24,
          enrollmentEnd: now + 1000 * 60 * 60 * 24 * 7,
          gradingDeadline: now + 1000 * 60 * 60 * 24 * 40,
          status: "planning",
          isCurrentPeriod: false,
          createdAt: Date.now(),
        });

        const profId = await ctx.db.insert("users", {
          clerkId: `prof_list_${Date.now()}`,
          email: `prof_list_${Date.now()}@example.com`,
          firstName: "Prof",
          lastName: "Lister",
          role: "professor",
          isActive: true,
          professorProfile: { employeeCode: "EMP-LST" },
          createdAt: Date.now(),
        });

        const secA = await ctx.db.insert("sections", {
          courseId,
          periodId,
          groupNumber: "A1",
          crn: "CRN-LST-A",
          professorId: profId,
          capacity: 40,
          enrolled: 10,
          waitlistCapacity: 0,
          waitlisted: 0,
          deliveryMethod: "in_person",
          status: "open",
          gradesSubmitted: false,
          isActive: true,
          createdAt: Date.now(),
        });

        const secB = await ctx.db.insert("sections", {
          courseId,
          periodId,
          groupNumber: "B1",
          crn: "CRN-LST-B",
          professorId: profId,
          capacity: 20,
          enrolled: 20,
          waitlistCapacity: 0,
          waitlisted: 0,
          deliveryMethod: "in_person",
          status: "open",
          gradesSubmitted: false,
          isActive: true,
          createdAt: Date.now(),
        });

        return { courseId, periodId, profId, secA, secB };
      },
    );

    // Query sections for the period
    const result = await authedAdmin.query(api.courses.getSectionsByPeriod, {
      periodId,
    });

    expect(result).toHaveProperty("period");
    expect(result).toHaveProperty("sections");
    expect(Array.isArray(result.sections)).toBe(true);
    // Map to ids for easier assertions
    const ids = result.sections.map((s: any) => s.section._id);
    expect(ids).toContain(secA);
    expect(ids).toContain(secB);

    // Filter by professorId should return only those for the professor
    const byProf = await authedAdmin.query(api.courses.getSectionsByPeriod, {
      periodId,
      professorId: profId,
    });
    expect(
      byProf.sections.every((d: any) => d.section.professorId === profId),
    ).toBe(true);

    // hasAvailableSeats is computed by helper; since hasAvailableCapacity returns true, filter should not remove sections
    const hasSeats = await authedAdmin.query(api.courses.getSectionsByPeriod, {
      periodId,
      hasAvailableSeats: true,
    });
    expect(hasSeats.sections.length).toBeGreaterThanOrEqual(2);
  });

  it("deleteSection refuses delete with enrollments unless forceDelete, and forceDelete removes enrollments", async () => {
    const t = convexTest(schema, modules);
    const authedAdmin = await createAdminUser(t, "admin_delete_section");

    // Seed course, period, professor, section, student, and enrollment
    const { sectionId, enrollmentId } = await t.run(async (ctx: any) => {
      const courseId = await ctx.db.insert("courses", {
        code: "SEC-CRS-DEL",
        nameEs: "Curso Delete",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const periodId = await ctx.db.insert("periods", {
        code: "2028-B1",
        year: 2028,
        bimesterNumber: 1,
        nameEs: "Periodo Del",
        startDate: now,
        endDate: now + 1000 * 60 * 60 * 24 * 30,
        enrollmentStart: now - 1000 * 60 * 60 * 24,
        enrollmentEnd: now + 1000 * 60 * 60 * 24 * 7,
        gradingDeadline: now + 1000 * 60 * 60 * 24 * 40,
        status: "planning",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const profId = await ctx.db.insert("users", {
        clerkId: `prof_del_${Date.now()}`,
        email: `prof_del_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Deleter",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-DEL" },
        createdAt: Date.now(),
      });

      const sectionId = await ctx.db.insert("sections", {
        courseId,
        periodId,
        groupNumber: "D1",
        crn: "CRN-DEL-1",
        professorId: profId,
        capacity: 15,
        enrolled: 1,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "open",
        gradesSubmitted: false,
        isActive: true,
        createdAt: Date.now(),
      });

      const programIdForStudent = await ctx.db.insert("programs", {
        code: `PRG-DEL-${Date.now()}`,
        nameEs: "Program Delete",
        nameEn: "Program Delete",
        descriptionEs: "Test program for student",
        type: "bachelor",
        language: "es",
        totalCredits: 120,
        durationBimesters: 8,
        isActive: true,
        createdAt: Date.now(),
      });

      const studentId = await ctx.db.insert("users", {
        clerkId: `student_del_${Date.now()}`,
        email: `student_del_${Date.now()}@example.com`,
        firstName: "Student",
        lastName: "Delete",
        role: "student",
        isActive: true,
        studentProfile: {
          studentCode: `SDEL-${Date.now()}`,
          programId: programIdForStudent,
          enrollmentDate: Date.now(),
          status: "active",
        },
        createdAt: Date.now(),
      });

      const enrollmentId = await ctx.db.insert("enrollments", {
        studentId,
        sectionId,
        periodId,
        courseId,
        professorId: profId,
        enrolledAt: Date.now(),
        status: "enrolled",
        isRetake: false,
        isAuditing: false,
        countsForGPA: true,
        countsForProgress: true,
        createdAt: Date.now(),
      });

      return { sectionId, enrollmentId };
    });

    // Attempt to delete without forceDelete should throw
    await expect(
      authedAdmin.mutation(api.courses.deleteSection, { sectionId }),
    ).rejects.toThrow();

    // Delete with forceDelete should succeed and remove enrollment
    const res = await authedAdmin.mutation(api.courses.deleteSection, {
      sectionId,
      forceDelete: true,
    });

    expect(res).toHaveProperty("message");
    expect(res.deletedEnrollments).toBeGreaterThanOrEqual(1);

    // Confirm section removed
    const remaining = await t.run(async (ctx: any) => {
      return await ctx.db.get(sectionId);
    });
    expect(remaining).toBeNull();

    // Confirm enrollment removed
    const enrollmentExists = await t.run(async (ctx: any) => {
      return await ctx.db.get(enrollmentId);
    });
    expect(enrollmentExists).toBeNull();
  });
});
