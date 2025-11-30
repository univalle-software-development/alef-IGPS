import EnrollmentTable from "@/components/admin/enrollment/enrollment-table";
import {useTranslations} from "next-intl";

export default function EnrollmentManagementPage() {
  const t = useTranslations("dashboard.admin.enrollments");
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
      <EnrollmentTable />
    </div>
  );
}
