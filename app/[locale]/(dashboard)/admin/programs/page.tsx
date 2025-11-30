import ProgramTable from "@/components/admin/program/program-table";
import { useTranslations } from "next-intl";

export default function ProgramManagementPage() {
  const t = useTranslations("dashboard.admin.programs");
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
      <ProgramTable />
    </div>
  );
}
