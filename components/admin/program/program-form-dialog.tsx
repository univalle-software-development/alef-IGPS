"use client";

import * as React from "react";
import { Save, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { Program, ProgramFormData } from "../types";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole } from "@/convex/types";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ProgramFormDialogProps {
  mode: "create" | "edit";
  program?: Program;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProgramFormDialog({
  mode,
  program,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ProgramFormDialogProps) {
  const t = useTranslations("components.admin.program.dialog");
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("general");

  // Get user role from Clerk
  const { user } = useUser();
  const userRole = user?.publicMetadata?.role as UserRole | undefined;
  const isSuperAdmin = userRole === "superadmin";

  // Convex mutations
  const updateProgram = useMutation(api.programs.updateProgram);
  const createProgram = useMutation(api.programs.createProgram);
  const deleteProgram = useMutation(api.programs.deleteProgram);

  const associatedCourses = useQuery(
    api.courses.getAllCourses,
    mode === "edit" && program ? { programId: program._id } : "skip"
  );

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Initialize form data based on mode and program
  const initialFormData = React.useMemo((): ProgramFormData => {
    if (mode === "edit" && program) {
      return {
        code: program.code,
        nameEs: program.nameEs,
        nameEn: program.nameEn || "",
        descriptionEs: program.descriptionEs,
        descriptionEn: program.descriptionEn || "",
        type: program.type,
        degree: program.degree || "",
        language: program.language,
        totalCredits: program.totalCredits,
        durationBimesters: program.durationBimesters,
        tuitionPerCredit: program.tuitionPerCredit || 0,
        isActive: program.isActive,
      };
    }
    return {
      code: "",
      nameEs: "",
      nameEn: "",
      descriptionEs: "",
      descriptionEn: "",
      type: undefined,
      degree: "",
      language: undefined,
      totalCredits: 0,
      durationBimesters: 0,
      tuitionPerCredit: 0,
      isActive: true,
    };
  }, [mode, program]);

  const [formData, setFormData] = React.useState(initialFormData);

  React.useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setActiveTab("general");
    }
  }, [open, initialFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateFormData(formData);
    if (validationErrors.length > 0) {
      toast.warning(t("fixErrorsWarning"), {
        description: (
          <ul className="list-disc pl-5">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        ),
      });
      return;
    }
    setIsLoading(true);

    try {
      if (mode === "create") {
        await createProgram({
          code: formData.code,
          nameEs: formData.nameEs,
          nameEn: formData.nameEn || undefined,
          descriptionEs: formData.descriptionEs,
          descriptionEn: formData.descriptionEn || undefined,
          type: formData.type!,
          degree: formData.degree || undefined,
          language: formData.language!,
          totalCredits: formData.totalCredits,
          durationBimesters: formData.durationBimesters,
          tuitionPerCredit:
            formData.tuitionPerCredit > 0
              ? formData.tuitionPerCredit
              : undefined,
        });
        toast.success(t("createSuccess"));
      } else {
        if (!program) return;
        await updateProgram({
          programId: program._id,
          nameEs: formData.nameEs,
          nameEn: formData.nameEn,
          descriptionEs: formData.descriptionEs,
          descriptionEn: formData.descriptionEn,
          degree: formData.degree,
          language: formData.language!,
          tuitionPerCredit: formData.tuitionPerCredit,
          isActive: formData.isActive,
        });
        toast.success(t("updateSuccess"));
      }
      setOpen(false);
    } catch (error) {
      console.error(`Failed to ${mode} program:`, error);
      toast.error(t("genericError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!program || mode === "create") return;

    toast.error(t("deleteConfirmation", { programName: program.nameEs }), {
      action: {
        label: t("deleteButton"),
        onClick: async () => {
          setIsDeleting(true);
          try {
            await deleteProgram({ programId: program._id });
            toast.success(t("deleteSuccess"));
            setOpen(false);
          } catch (error) {
            console.error("Failed to delete program:", error);
            toast.error(t("deleteError"));
          } finally {
            setIsDeleting(false);
          }
        },
      },
      cancel: {
        label: t("cancelButton"),
        onClick: () => {
          // Do nothing
        },
      },
    });
  };

  const updateFormData = (field: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateFormData = (data: ProgramFormData): string[] => {
    const errors: string[] = [];

    if (!data.code.trim()) errors.push("Program code is required");
    if (!data.type) errors.push("Program type is required");
    if (!data.language) errors.push("Teaching language is required");
    if (data.totalCredits <= 0) errors.push("Total credits must be greater than 0");
    if (data.durationBimesters <= 0) errors.push("Duration must be greater than 0");

    // Validate required fields based on selected language
    if (data.language === "es" || data.language === "both") {
      if (!data.nameEs.trim()) errors.push("Spanish name is required");
      if (!data.descriptionEs.trim()) errors.push("Spanish description is required");
    }

    if (data.language === "en" || data.language === "both") {
      if (!data.nameEn.trim()) errors.push("English name is required");
      if (!data.descriptionEn.trim()) errors.push("English description is required");
    }

    return errors;
  };

  const getFieldEnabledState = () => {
    const language = formData.language;
    const languageEnabled = {
      nameEs: language === "es" || language === "both",
      nameEn: language === "en" || language === "both",
      descriptionEs: language === "es" || language === "both",
      descriptionEn: language === "en" || language === "both"
    };

    if (mode === "edit" && program) {
      return {
        nameEs: languageEnabled.nameEs && (!program.nameEs || program.nameEs.trim() === ""),
        nameEn: languageEnabled.nameEn && (!program.nameEn || program.nameEn.trim() === ""),
        descriptionEs: languageEnabled.descriptionEs,
        descriptionEn: languageEnabled.descriptionEn
      };
    }
    return languageEnabled;
  };

  const fieldEnabled = getFieldEnabledState();
  const isCreate = mode === "create";
  const dialogTitle = isCreate ? t("createTitle") : t("updateTitle");
  const dialogDescription = isCreate
    ? t("createInstruction")
    : t("updateInstruction");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl">
        <DialogHeader className="space-y-4 pb-4 border-b border-border">
          <DialogTitle className="text-2xl font-bold text-center text-foreground flex items-center justify-center gap-3">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-base">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">Información general</TabsTrigger>
            <TabsTrigger value="details" disabled={mode === "create"}>
              Detalles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-8 py-2">
                {/* Basic Information */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                    <div className="w-2 h-2 rounded-full bg-deep-koamaru"></div>
                    <h3 className="text-lg font-semibold text-foreground">
                        {t("basicInformation")}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-sm font-semibold text-foreground">
                        {t("programCode")} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => updateFormData("code", e.target.value)}
                        placeholder={t("programCodePlaceholder")}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        disabled={!isCreate}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type" className="text-sm font-semibold text-foreground">
                        {t("programType")} <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.type || ""}
                        onValueChange={(value) => updateFormData("type", value as Program['type'])}
                        disabled={!isCreate}
                      >
                        <SelectTrigger className="w-full border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200">
                          <SelectValue placeholder={t("programTypePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border shadow-lg">
                          <SelectItem value="diploma">Diploma</SelectItem>
                          <SelectItem value="bachelor">Bachelor</SelectItem>
                          <SelectItem value="master">Master</SelectItem>
                          <SelectItem value="doctorate">Doctorate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="degree" className="text-sm font-semibold text-foreground">
                        {t("degreeTitle")}
                      </Label>
                      <Input
                        id="degree"
                        value={formData.degree}
                        onChange={(e) => updateFormData("degree", e.target.value)}
                        placeholder={t("degreeTitlePlaceholder")}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        disabled={!isCreate}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language" className="text-sm font-semibold text-foreground">
                        {t("teachingLanguage")} <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.language || ""}
                        onValueChange={(value) => updateFormData("language", value as Program['language'])}
                      >
                        <SelectTrigger className="w-full border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200">
                          <SelectValue placeholder={t("teachingLanguagePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border shadow-lg">
                          <SelectItem value="es">{t("spanish")}</SelectItem>
                          <SelectItem value="en">{t("english")}</SelectItem>
                          <SelectItem value="both">{t("spanishEnglish")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="nameEs" className="text-sm font-semibold text-foreground">
                        {t("nameSpanish")} {(formData.language === "es" || formData.language === "both") && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="nameEs"
                        value={formData.nameEs}
                        onChange={(e) => updateFormData("nameEs", e.target.value)}
                        placeholder={t("nameSpanishPlaceholder")}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        disabled={isCreate ? !fieldEnabled.nameEs : !fieldEnabled.nameEs}
                        required={formData.language === "es" || formData.language === "both"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nameEn" className="text-sm font-semibold text-foreground">
                        {t("nameEnglish")} {(formData.language === "en" || formData.language === "both") && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="nameEn"
                        value={formData.nameEn}
                        onChange={(e) => updateFormData("nameEn", e.target.value)}
                        placeholder={t("nameEnglishPlaceholder")}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        disabled={isCreate ? !fieldEnabled.nameEn : !fieldEnabled.nameEn}
                        required={formData.language === "en" || formData.language === "both"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="descriptionEs" className="text-sm font-semibold text-foreground">
                        {t("descriptionSpanish")}{(formData.language === "es" || formData.language === "both") && <span className="text-destructive">*</span>}
                      </Label>
                      <Textarea
                        id="descriptionEs"
                        value={formData.descriptionEs}
                        onChange={(e) => updateFormData("descriptionEs", e.target.value)}
                        placeholder={t("descriptionSpanishPlaceholder")}
                        className="min-h-[100px] resize-none border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        disabled={!fieldEnabled.descriptionEs}
                        required={formData.language === "es" || formData.language === "both"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descriptionEn" className="text-sm font-semibold text-foreground">
                        {t("descriptionEnglish")} {(formData.language === "en" || formData.language === "both") && <span className="text-destructive">*</span>}
                      </Label>
                      <Textarea
                        id="descriptionEn"
                        value={formData.descriptionEn}
                        onChange={(e) => updateFormData("descriptionEn", e.target.value)}
                        placeholder={t("descriptionEnglishPlaceholder")}
                        className="min-h-[100px] resize-none border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        disabled={!fieldEnabled.descriptionEn}
                        required={formData.language === "en" || formData.language === "both"}
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Information */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                    <div className="w-2 h-2 rounded-full bg-deep-koamaru"></div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {t("academicInformation")}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="totalCredits" className="text-sm font-semibold text-foreground">
                        {t("totalCredits")} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="totalCredits"
                        type="number"
                        value={formData.totalCredits === 0 ? "" : formData.totalCredits}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                          updateFormData("totalCredits", isNaN(value) ? 0 : value);
                        }}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        min="1"
                        disabled={!isCreate}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="durationBimesters" className="text-sm font-semibold text-foreground">
                        {t("durationBimesters")} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="durationBimesters"
                        type="number"
                        value={formData.durationBimesters === 0 ? "" : formData.durationBimesters}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                          updateFormData("durationBimesters", isNaN(value) ? 0 : value);
                        }}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        min="1"
                        disabled={!isCreate}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tuitionPerCredit" className="text-sm font-semibold text-foreground">
                        {t("tuitionPerCredit")}
                      </Label>
                      <Input
                        id="tuitionPerCredit"
                        type="number"
                        value={formData.tuitionPerCredit === 0 ? "" : formData.tuitionPerCredit}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          updateFormData("tuitionPerCredit", isNaN(value) ? 0 : value);
                        }}
                        className="border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                        min="0"
                        step="0.01"
                        disabled={!isCreate}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="isActive" className="text-sm font-semibold text-foreground">
                      {t("programAvailability")} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={isCreate ? "" : formData.isActive.toString()}
                      onValueChange={(value) => updateFormData("isActive", value === "true")}
                    >
                      <SelectTrigger className="w-full border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200">
                        <SelectValue placeholder={t("programAvailabilityPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border shadow-lg">
                        <SelectItem value="true">{t("available")}</SelectItem>
                        <SelectItem value="false">{t("unavailable")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Info Section */}
                <div className="bg-fuzzy-wuzzy/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-sm space-y-2">
                      <p className="font-medium text-foreground">
                        <span className="text-destructive">*</span> {t("requiredFields")}
                      </p>
                      {!isCreate && (
                        <p className="text-foreground">
                          {t("readonlyWarning")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border bg-muted/10 -mx-6 -mb-6 px-6 pb-6 rounded-b-xl">
                <div className="flex gap-3 w-full justify-between">
                  <div className="flex gap-3 ml-auto">
                    {!isCreate && isSuperAdmin && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isLoading || isDeleting}
                        className="px-6 py-2.5"
                      >
                        {isDeleting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Deleting...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            {t("deleteButton")}
                          </div>
                        )}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="default"
                      disabled={isLoading || isDeleting}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {isCreate ? "Creating..." : "Saving..."}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Save className="h-4 w-4" />
                          {isCreate ? t("createButton") : t("updateButton")}
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="details" className="space-y-6 mt-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                  <div className="w-2 h-2 rounded-full bg-deep-koamaru"></div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Associated Courses
                  </h3>
                </div>

                {associatedCourses === undefined ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-muted-foreground text-sm">Loading courses...</p>
                    </div>
                  </div>
                ) : associatedCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No courses are currently associated with this program.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {associatedCourses.map((course) => (
                      <div
                        key={course._id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-foreground">
                              {course.code}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {course.credits} credits
                            </span>
                          </div>
                          <p className="text-sm text-foreground">
                            {course.nameEs}
                          </p>
                          {course.nameEn && (
                            <p className="text-xs text-muted-foreground">
                              {course.nameEn}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {course.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}