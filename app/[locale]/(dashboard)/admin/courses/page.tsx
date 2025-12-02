import CourseTable from "@/components/admin/course/course-table";
import { useTranslations } from "next-intl";

export default function CourseManagementPage() {
  const t = useTranslations("dashboard.admin.courses");

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {t("title")}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
            {t("subtitle")}
        </p>
      </div>

      {/* Main Content */}
      <CourseTable />
    </div>
  );
}
