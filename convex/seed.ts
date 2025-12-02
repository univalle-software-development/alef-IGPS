// ################################################################################
// # File: seed.ts                                                               #
// # Description: Seeds the database with initial data for Alef University.       #
// # To run: Go to the Convex dashboard, select this function, and run it.        #
// ################################################################################

import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Helper mutation to delete a specific user by ID
 */
export const deleteUserById = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.userId);
    },
});

/**
 * Internal mutation helper to delete all documents from a table
 */
export const deleteAllFromTable = internalMutation({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const tableName = args.table as any;
    const documents = await ctx.db.query(tableName).collect();
    
    let count = 0;
    for (const doc of documents) {
      await ctx.db.delete(doc._id);
      count++;
    }
    
    console.log(`  Deleted ${count} documents from ${args.table}`);
    return count;
  },
});

/**
 * Clean/Revert the database before seeding
 * WARNING: This will delete ALL data from the specified tables
 */
export const revertSeed = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    console.log("🧹 Starting database cleanup process...");

    try {
      // Delete in reverse order of dependencies
      console.log("Deleting enrollments...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "enrollments" });

      console.log("Deleting sections...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "sections" });

      console.log("Deleting program_courses associations...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "program_courses" });

      console.log("Deleting courses...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "courses" });

      console.log("Deleting periods...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "periods" });

      console.log("Deleting programs...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "programs" });

      console.log("Deleting users...");
      await ctx.runMutation(internal.seed.deleteAllFromTable, { table: "users" });

      console.log("✅ Database cleanup completed successfully!");
      return { success: true, message: "All seed data has been removed" };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Error during cleanup:", errorMessage);
      throw new ConvexError(`Cleanup failed: ${errorMessage}`);
    }
  },
});

/**
 * Seed the database with initial data
 * Optionally clean existing data first
 */
export const seedDatabase = internalAction({
  args: {
    cleanFirst: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    summary: {
      professor: number;
      program: number;
      courses: number;
      sections: number;
      students: number;
      enrollments: number;
    };
  }> => {
    console.log("🚀 Starting database seeding process...");

    // Clean existing data if requested
    if (args.cleanFirst) {
      console.log("Cleaning existing data first...");
      await ctx.runAction(internal.seed.revertSeed, {});
    }

    const now = new Date();
    const year = now.getFullYear();

    // --- 1. Create a Professor ---
    console.log("Creating professor...");
    const professorResult = await ctx.runAction(internal.admin.internalCreateUserWithClerk, {
        email: "alvaradomariana184@gmail.com",
        firstName: "Mariana",
        lastName: "Alvarado",
        role: "professor",
        professorProfile: {
            employeeCode: "PROF-002",
            title: "Dr.",
            department: "Sociology",
            hireDate: Date.now(),
        }
    });
    const professorId = professorResult.userId;
    console.log(`✅ Professor created with ID: ${professorId}`);

    // --- 2. Create the Academic Program ---
    console.log("Creating academic program...");
    const programId = await ctx.runMutation(internal.programs.internalCreateProgram, {
      code: "14M",
      nameEs: "Maestría en Razonamiento Cristiano",
      descriptionEs: "Programa de maestría enfocado en el estudio profundo del razonamiento cristiano a lo largo de la historia.",
      type: "master",
      language: "es",
      totalCredits: 40,
      durationBimesters: 6,
    });
    console.log(`✅ Program created with ID: ${programId}`);

    // --- 3. Create Courses and associate with the Program ---
    console.log("Creating courses...");
    const coursesData = [
      { code: "MTHSR-07", name: "Teología en el razonamiento humano", credits: 3 },
      { code: "MTHHR-11", name: "Historia del razonamiento latinoamericano", credits: 3 },
      { code: "MTHHR-12", name: "Razonamiento cristiano y la Iglesia del s XXI", credits: 3 },
    ];

    const courseIds: Id<"courses">[] = [];
    for (const course of coursesData) {
      const courseId = await ctx.runMutation(internal.courses.internalCreateCourse, {
        code: course.code,
        nameEs: course.name,
        descriptionEs: `Curso de ${course.name}`,
        credits: course.credits,
        language: "es",
        category: "core",
        prerequisites: [],
      });
      await ctx.runMutation(internal.courses.internalAddCourseToProgram, {
        courseId: courseId,
        programId: programId,
        isRequired: true,
      });
      courseIds.push(courseId);
      console.log(`  - Course '${course.name}' created.`);
    }
    console.log(`✅ ${courseIds.length} courses created and associated with the program.`);

    // --- 4. Create an Academic Period ---
    console.log("Creating academic period...");
    const periodId = await ctx.runMutation(internal.admin.internalCreatePeriod, {
        code: `${year}-B4`,
        year: year,
        bimesterNumber: 4,
        nameEs: `Cuarto Bimestre ${year}`,
        startDate: now.getTime(),
        endDate: now.getTime() + (60 * 24 * 60 * 60 * 1000),
        enrollmentStart: now.getTime() - (7 * 24 * 60 * 60 * 1000),
        enrollmentEnd: now.getTime() + (7 * 24 * 60 * 60 * 1000),
        gradingDeadline: now.getTime() + (65 * 24 * 60 * 60 * 1000),
    });
    await ctx.runMutation(internal.admin.internalUpdatePeriodStatus, {
        periodId: periodId,
        status: "enrollment",
        isCurrentPeriod: true,
    });
    console.log(`✅ Academic Period created for ${year}-B4 and set to current.`);

    // --- 5. Create Sections for Courses ---
    console.log("Creating sections for each course...");
    const sectionIds: Id<"sections">[] = [];
    for (const courseId of courseIds) {
        const section = await ctx.runMutation(internal.courses.internalCreateSection, {
            courseId: courseId,
            periodId: periodId,
            groupNumber: "01",
            professorId: professorId,
            capacity: 25,
            deliveryMethod: "online_async",
        });
        await ctx.runMutation(internal.courses.internalUpdateSection, {
            sectionId: section.sectionId,
            status: "open",
        });
        sectionIds.push(section.sectionId);
    }
    console.log(`✅ ${sectionIds.length} sections created and opened for enrollment.`);

    // --- 6. Create Students via Clerk Invitation ---
    console.log("Creating students and sending invitations...");
    const studentsData = [
      { firstName: "Laura", lastName: "Betancourth1", email: "laura.betancourth2004@gmail.com" },
      { firstName: "Laura", lastName: "Betancourth2", email: "lau.betancourt.horta@gmail.com" },
    ];

    const studentConvexIds: Id<"users">[] = [];
    for (const [index, student] of studentsData.entries()) {
        try {
            console.log(`  - Creating student ${student.email}...`);
            const result = await ctx.runAction(internal.admin.internalCreateUserWithClerk, {
              email: student.email,
              firstName: student.firstName,
              lastName: student.lastName,
              role: "student",
              studentProfile: {
                  studentCode: `MTH-${year}-${String(index + 1).padStart(3, '0')}`,
                  programId: programId,
                  enrollmentDate: Date.now(),
                  status: "active",
              }
            });

            console.log(`  - Student created with userId: ${result.userId}`);
            studentConvexIds.push(result.userId);
            console.log(`  ✅ Invitation sent to ${student.email}.`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  ❌ Failed to invite ${student.email}: ${errorMessage}`);
            // Continue with next student even if one fails
        }
    }
    console.log(`✅ ${studentConvexIds.length} students created successfully.`);
    
    // --- 7. Enroll Students in Sections ---
    console.log("Enrolling students in sections...");
    console.log(`  - Students to enroll: ${studentConvexIds.length}`);
    console.log(`  - Sections available: ${sectionIds.length}`);
    
    const sectionsToEnroll = sectionIds;
    console.log(`  - Will enroll in first ${sectionsToEnroll.length} sections`);
    
    let enrollmentCount = 0;
    for (const studentId of studentConvexIds) {
        console.log(`  - Enrolling student ${studentId}...`);
        for (const sectionId of sectionsToEnroll) {
            try {
                await ctx.runMutation(internal.admin.internalForceEnrollStudent, {
                    studentId,
                    sectionId,
                    enrolledBy: professorId,
                    reason: "Initial seed enrollment",
                });
                console.log(`    ✓ Enrolled in section ${sectionId}`);
                enrollmentCount++;
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`    ✗ Could not enroll student ${studentId} in ${sectionId}: ${errorMessage}`);
            }
        }
    }
    console.log(`✅ ${enrollmentCount} total enrollments created.`);

    console.log("🎉 Database seeding process completed successfully!");

    return { 
      success: true,
      summary: {
        professor: 1,
        program: 1,
        courses: courseIds.length,
        sections: sectionIds.length,
        students: studentConvexIds.length,
        enrollments: enrollmentCount,
      }
    };
  },
});