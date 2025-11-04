import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("Students Convex functions", () => {
  it("getMyEnrollments returns enrollments for the specified period", async () => {
    const t = convexTest(schema, modules);

    // Seed a student, period, course, professor, section and enrollment
    const { clerkId, periodId } = await t.run(async (ctx: any) => {
      const clerkId = `stu_enr_${Date.now()}`;
      const studentId = await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        firstName: "Enroll",
        lastName: "Student",
        role: "student",
        isActive: true,
        createdAt: Date.now(),
      });

      const periodId = await ctx.db.insert("periods", {
        code: `PER-${Date.now()}`,
        year: 2025,
        bimesterNumber: 1,
        nameEs: "Periodo ENR",
        startDate: Date.now(),
        endDate: Date.now() + 1000 * 60 * 60 * 24 * 30,
        enrollmentStart: Date.now() - 1000 * 60 * 60 * 24,
        enrollmentEnd: Date.now() + 1000 * 60 * 60 * 24 * 10,
        gradingDeadline: Date.now() + 1000 * 60 * 60 * 24 * 40,
        status: "planning",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const courseId = await ctx.db.insert("courses", {
        code: `CRS-ENR-${Date.now()}`,
        nameEs: "Curso Enroll",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const professorId = await ctx.db.insert("users", {
        clerkId: `prof_enr_${Date.now()}`,
        email: `prof_enr_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Enroll",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-ENR" },
        createdAt: Date.now(),
      });

      const section = await ctx.db.insert("sections", {
        courseId,
        periodId,
        groupNumber: "01",
        crn: `CRN-${Date.now()}`,
        professorId,
        capacity: 30,
        enrolled: 1,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "open",
        gradesSubmitted: false,
        isActive: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("enrollments", {
        studentId,
        sectionId: section,
        periodId,
        courseId,
        professorId,
        enrolledAt: Date.now(),
        enrolledBy: studentId,
        status: "enrolled",
        isRetake: false,
        isAuditing: false,
        countsForGPA: true,
        countsForProgress: true,
        createdAt: Date.now(),
      });

      return { clerkId, periodId };
    });

    // Act as the student and query enrollments for periodId
    const studentT = t.withIdentity({ subject: clerkId });
    const result = await studentT.query(api.students.getMyEnrollments, {
      periodId,
    });

    expect(result).toBeDefined();
    expect(result.period._id).toBe(periodId);
    expect(Array.isArray(result.enrollments)).toBe(true);
    expect(result.enrollments.length).toBeGreaterThanOrEqual(1);
    const ed = result.enrollments[0];
    expect(ed).toHaveProperty("enrollment");
    expect(ed).toHaveProperty("section");
    expect(ed).toHaveProperty("course");
  });

  it("getMySchedule returns schedule items for enrolled courses", async () => {
    const t = convexTest(schema, modules);

    const { clerkId, periodId, sectionId, schedule } = await t.run(
      async (ctx: any) => {
        const clerkId = `stu_sched_${Date.now()}`;
        const studentId = await ctx.db.insert("users", {
          clerkId,
          email: `${clerkId}@example.com`,
          firstName: "Sched",
          lastName: "Student",
          role: "student",
          isActive: true,
          createdAt: Date.now(),
        });

        const periodId = await ctx.db.insert("periods", {
          code: `PER-SCH-${Date.now()}`,
          year: 2025,
          bimesterNumber: 1,
          nameEs: "Periodo SCH",
          startDate: Date.now(),
          endDate: Date.now() + 1000 * 60 * 60 * 24 * 30,
          enrollmentStart: Date.now() - 1000 * 60 * 60 * 24,
          enrollmentEnd: Date.now() + 1000 * 60 * 60 * 24 * 10,
          gradingDeadline: Date.now() + 1000 * 60 * 60 * 24 * 40,
          status: "planning",
          isCurrentPeriod: false,
          createdAt: Date.now(),
        });

        const courseId = await ctx.db.insert("courses", {
          code: `CRS-SCH-${Date.now()}`,
          nameEs: "Curso Schedule",
          descriptionEs: "Desc",
          credits: 3,
          language: "es",
          category: "core",
          prerequisites: [],
          isActive: true,
          createdAt: Date.now(),
        });

        const profId = await ctx.db.insert("users", {
          clerkId: `prof_sch_${Date.now()}`,
          email: `prof_sch_${Date.now()}@example.com`,
          firstName: "Prof",
          lastName: "Sched",
          role: "professor",
          isActive: true,
          professorProfile: { employeeCode: "EMP-SCH" },
          createdAt: Date.now(),
        });

        const schedule = {
          sessions: [
            { day: "monday", startTime: "10:00", endTime: "12:00" },
            { day: "wednesday", startTime: "10:00", endTime: "12:00" },
          ],
          timezone: "America/Bogota",
        };

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          periodId,
          groupNumber: "S1",
          crn: `CRN-SCH-${Date.now()}`,
          professorId: profId,
          capacity: 20,
          enrolled: 1,
          waitlistCapacity: 0,
          waitlisted: 0,
          deliveryMethod: "in_person",
          status: "open",
          schedule,
          gradesSubmitted: false,
          isActive: true,
          createdAt: Date.now(),
        });

        await ctx.db.insert("enrollments", {
          studentId,
          sectionId,
          periodId,
          courseId,
          professorId: profId,
          enrolledAt: Date.now(),
          enrolledBy: studentId,
          status: "enrolled",
          isRetake: false,
          isAuditing: false,
          countsForGPA: true,
          countsForProgress: true,
          createdAt: Date.now(),
        });

        return { clerkId, periodId, sectionId, schedule };
      },
    );

    const studentT = t.withIdentity({ subject: clerkId });
    const res = await studentT.query(api.students.getMySchedule, { periodId });

    expect(res).toBeDefined();
    expect(res.period._id).toBe(periodId);
    expect(Array.isArray(res.schedule)).toBe(true);
    expect(res.schedule.length).toBeGreaterThanOrEqual(1);
    const item = res.schedule[0];
    expect(item).toHaveProperty("schedule");
    expect(item.schedule).toEqual(schedule);
  });

  it("getMyGrades returns grades for the given period and computes periodGPA", async () => {
    const t = convexTest(schema, modules);

    const { clerkId, periodId, courseId } = await t.run(async (ctx: any) => {
      const clerkId = `stu_grade_${Date.now()}`;
      const studentId = await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        firstName: "Grade",
        lastName: "Student",
        role: "student",
        isActive: true,
        createdAt: Date.now(),
      });

      const periodId = await ctx.db.insert("periods", {
        code: `PER-GRD-${Date.now()}`,
        year: 2025,
        bimesterNumber: 1,
        nameEs: "Periodo GRD",
        startDate: Date.now(),
        endDate: Date.now() + 1000 * 60 * 60 * 24 * 30,
        enrollmentStart: Date.now() - 1000 * 60 * 60 * 24,
        enrollmentEnd: Date.now() + 1000 * 60 * 60 * 24 * 10,
        gradingDeadline: Date.now() + 1000 * 60 * 60 * 24 * 40,
        status: "grading",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const courseId = await ctx.db.insert("courses", {
        code: `CRS-GRD-${Date.now()}`,
        nameEs: "Curso Grade",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const profId = await ctx.db.insert("users", {
        clerkId: `prof_grd_${Date.now()}`,
        email: `prof_grd_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Grade",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-GRD" },
        createdAt: Date.now(),
      });

      const sectionId = await ctx.db.insert("sections", {
        courseId,
        periodId,
        groupNumber: "G1",
        crn: `CRN-GRD-${Date.now()}`,
        professorId: profId,
        capacity: 25,
        enrolled: 1,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "completed",
        gradesSubmitted: true,
        isActive: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("enrollments", {
        studentId,
        sectionId,
        periodId,
        courseId,
        professorId: profId,
        enrolledAt: Date.now(),
        enrolledBy: studentId,
        status: "completed",
        percentageGrade: 88,
        letterGrade: "B+",
        gradePoints: 3.3,
        qualityPoints: 3.3 * 3,
        isRetake: false,
        isAuditing: false,
        countsForGPA: true,
        countsForProgress: true,
        createdAt: Date.now(),
      });

      return { clerkId, periodId, courseId };
    });

    const studentT = t.withIdentity({ subject: clerkId });
    const res = await studentT.query(api.students.getMyGrades, { periodId });

    expect(res).toBeDefined();
    expect(res.period._id).toBe(periodId);
    expect(Array.isArray(res.grades)).toBe(true);
    expect(res.grades.length).toBeGreaterThanOrEqual(1);
    expect(res.periodGPA).toHaveProperty("gpa");
    expect(res.statistics.totalCourses).toBeGreaterThanOrEqual(1);
  });

  it("getMyAcademicHistory compiles period summaries and overall GPA", async () => {
    const t = convexTest(schema, modules);

    const { clerkId } = await t.run(async (ctx: any) => {
      const clerkId = `stu_hist_${Date.now()}`;
      const studentId = await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        firstName: "History",
        lastName: "Student",
        role: "student",
        isActive: true,
        createdAt: Date.now(),
      });

      // Create two periods and related enrollments
      const p1 = await ctx.db.insert("periods", {
        code: `P-H1-${Date.now()}`,
        year: 2024,
        bimesterNumber: 6,
        nameEs: "Hist P1",
        startDate: Date.now() - 1000 * 60 * 60 * 24 * 365,
        endDate: Date.now() - 1000 * 60 * 60 * 24 * 300,
        enrollmentStart: Date.now() - 1000 * 60 * 60 * 24 * 400,
        enrollmentEnd: Date.now() - 1000 * 60 * 60 * 24 * 350,
        gradingDeadline: Date.now() - 1000 * 60 * 60 * 24 * 320,
        status: "closed",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const p2 = await ctx.db.insert("periods", {
        code: `P-H2-${Date.now()}`,
        year: 2025,
        bimesterNumber: 1,
        nameEs: "Hist P2",
        startDate: Date.now() - 1000 * 60 * 60 * 24 * 200,
        endDate: Date.now() - 1000 * 60 * 60 * 24 * 150,
        enrollmentStart: Date.now() - 1000 * 60 * 60 * 24 * 220,
        enrollmentEnd: Date.now() - 1000 * 60 * 60 * 24 * 160,
        gradingDeadline: Date.now() - 1000 * 60 * 60 * 24 * 140,
        status: "closed",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const course1 = await ctx.db.insert("courses", {
        code: `CRS-H1-${Date.now()}`,
        nameEs: "Course History 1",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const course2 = await ctx.db.insert("courses", {
        code: `CRS-H2-${Date.now()}`,
        nameEs: "Course History 2",
        descriptionEs: "Desc",
        credits: 4,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      const prof = await ctx.db.insert("users", {
        clerkId: `prof_hist_${Date.now()}`,
        email: `prof_hist_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Hist",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-H" },
        createdAt: Date.now(),
      });

      const s1 = await ctx.db.insert("sections", {
        courseId: course1,
        periodId: p1,
        groupNumber: "H1",
        crn: `CRN-H1-${Date.now()}`,
        professorId: prof,
        capacity: 30,
        enrolled: 1,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "completed",
        gradesSubmitted: true,
        isActive: true,
        createdAt: Date.now(),
      });

      const s2 = await ctx.db.insert("sections", {
        courseId: course2,
        periodId: p2,
        groupNumber: "H2",
        crn: `CRN-H2-${Date.now()}`,
        professorId: prof,
        capacity: 30,
        enrolled: 1,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "completed",
        gradesSubmitted: true,
        isActive: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("enrollments", {
        studentId,
        sectionId: s1,
        periodId: p1,
        courseId: course1,
        professorId: prof,
        enrolledAt: Date.now(),
        status: "completed",
        percentageGrade: 90,
        letterGrade: "A-",
        gradePoints: 3.7,
        qualityPoints: 3.7 * 3,
        isRetake: false,
        isAuditing: false,
        countsForGPA: true,
        countsForProgress: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("enrollments", {
        studentId,
        sectionId: s2,
        periodId: p2,
        courseId: course2,
        professorId: prof,
        enrolledAt: Date.now(),
        status: "completed",
        percentageGrade: 85,
        letterGrade: "B",
        gradePoints: 3.0,
        qualityPoints: 3.0 * 4,
        isRetake: false,
        isAuditing: false,
        countsForGPA: true,
        countsForProgress: true,
        createdAt: Date.now(),
      });

      return { clerkId };
    });

    const studentT = t.withIdentity({ subject: clerkId });
    const res = await studentT.query(api.students.getMyAcademicHistory, {});

    expect(res).toBeDefined();
    expect(Array.isArray(res.history)).toBe(true);
    expect(res.history.length).toBeGreaterThanOrEqual(2);
    expect(res.overallGPA).toHaveProperty("gpa");
  });

  it("getMyProgress returns progress, curriculum and summary when program information exists", async () => {
    const t = convexTest(schema, modules);

    const { clerkId, programId, courseId } = await t.run(async (ctx: any) => {
      const clerkId = `stu_prog_${Date.now()}`;
      const studentId = await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        firstName: "Prog",
        lastName: "Student",
        role: "student",
        isActive: true,
        createdAt: Date.now(),
      });

      const programId = await ctx.db.insert("programs", {
        code: `PRG-${Date.now()}`,
        nameEs: "Program Test",
        nameEn: "Program Test EN",
        descriptionEs: "Programa de prueba",
        descriptionEn: "Test program description",
        type: "bachelor",
        language: "es",
        totalCredits: 120,
        durationBimesters: 8,
        isActive: true,
        createdAt: Date.now(),
      });

      // Patch student to include studentProfile pointing to the program (ensure studentProfile fields exist)
      await ctx.db.patch(studentId, {
        studentProfile: {
          studentCode: `S-${Date.now()}`,
          programId,
          enrollmentDate: Date.now(),
          status: "active",
        },
        updatedAt: Date.now(),
      });

      // Create program requirements to allow progress calculation
      await ctx.db.insert("program_requirements", {
        programId,
        requirements: {
          humanities: { required: 10 },
          core: { required: 80 },
          elective: { required: 20 },
          general: { required: 10 },
          total: 120,
        },
        minGPA: 2.0,
        minCGPA: 2.0,
        maxBimesters: 48,
        maxYears: 8,
        probationGPA: 2.0,
        suspensionGPA: 1.0,
        effectiveDate: Date.now(),
        isActive: true,
        createdAt: Date.now(),
      });

      // Create a course and associate with program
      const courseId = await ctx.db.insert("courses", {
        code: `CRS-PROG-${Date.now()}`,
        nameEs: "Course Prog",
        descriptionEs: "Desc",
        credits: 3,
        language: "es",
        category: "core",
        prerequisites: [],
        isActive: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("program_courses", {
        programId,
        courseId,
        isRequired: true,
        categoryOverride: "core",
        isActive: true,
        createdAt: Date.now(),
      });

      // Create a period and section and a completed enrollment to represent progress
      const periodId = await ctx.db.insert("periods", {
        code: `PER-PROG-${Date.now()}`,
        year: 2025,
        bimesterNumber: 1,
        nameEs: "Periodo Prog",
        startDate: Date.now(),
        endDate: Date.now() + 1000 * 60 * 60 * 24 * 30,
        enrollmentStart: Date.now() - 1000 * 60 * 60 * 24,
        enrollmentEnd: Date.now() + 1000 * 60 * 60 * 24 * 10,
        gradingDeadline: Date.now() + 1000 * 60 * 60 * 24 * 40,
        status: "closed",
        isCurrentPeriod: false,
        createdAt: Date.now(),
      });

      const profId = await ctx.db.insert("users", {
        clerkId: `prof_prog_${Date.now()}`,
        email: `prof_prog_${Date.now()}@example.com`,
        firstName: "Prof",
        lastName: "Prog",
        role: "professor",
        isActive: true,
        professorProfile: { employeeCode: "EMP-PROG" },
        createdAt: Date.now(),
      });

      const sectionId = await ctx.db.insert("sections", {
        courseId,
        periodId,
        groupNumber: "C1",
        crn: `CRN-PROG-${Date.now()}`,
        professorId: profId,
        capacity: 30,
        enrolled: 1,
        waitlistCapacity: 0,
        waitlisted: 0,
        deliveryMethod: "in_person",
        status: "completed",
        gradesSubmitted: true,
        isActive: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("enrollments", {
        studentId,
        sectionId,
        periodId,
        courseId,
        professorId: profId,
        enrolledAt: Date.now(),
        status: "completed",
        percentageGrade: 92,
        letterGrade: "A",
        gradePoints: 4.0,
        qualityPoints: 4.0 * 3,
        isRetake: false,
        isAuditing: false,
        countsForGPA: true,
        countsForProgress: true,
        createdAt: Date.now(),
      });

      return { clerkId, programId, courseId };
    });

    const studentT = t.withIdentity({ subject: clerkId });
    const res = await studentT.query(api.students.getMyProgress, {});

    expect(res).toBeDefined();
    expect(res).toHaveProperty("progress");
    expect(res).toHaveProperty("curriculum");
    expect(res.summary).toHaveProperty("gpa");
    // Curriculum should include core category with the created course
    expect(Array.isArray(res.curriculum.core)).toBe(true);
    expect(res.curriculum.core.length).toBeGreaterThanOrEqual(1);
  });

  it("requestDocument creates a document log and returns a documentLogId", async () => {
    const t = convexTest(schema, modules);

    const { clerkId } = await t.run(async (ctx: any) => {
      const clerkId = `stu_doc_${Date.now()}`;
      const studentId = await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        firstName: "Doc",
        lastName: "Student",
        role: "student",
        isActive: true,
        createdAt: Date.now(),
      });

      return { clerkId };
    });

    const studentT = t.withIdentity({ subject: clerkId });

    const resp = await studentT.mutation(api.students.requestDocument, {
      documentType: "transcript",
      scope: undefined,
      language: "es",
      format: "pdf",
    });

    expect(resp).toBeDefined();
    expect(resp).toHaveProperty("documentLogId");
    expect(resp).toHaveProperty("status");
    expect(resp.status).toMatch(/Document request submitted successfully/);
  });
});
