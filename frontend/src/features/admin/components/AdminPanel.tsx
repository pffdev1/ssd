"use client";

import { useMemo, useState } from "react";
import { AdminOverviewSection } from "@/src/features/admin/components/AdminOverviewSection";
import { AdminUsersSection } from "@/src/features/admin/components/AdminUsersSection";
import { ApprovedLinesSection } from "@/src/features/admin/components/ApprovedLinesSection";
import { CatalogSection } from "@/src/features/admin/components/CatalogSection";
import { DepartmentOrgChartSection } from "@/src/features/admin/components/DepartmentOrgChartSection";
import { WorkflowSection } from "@/src/features/admin/components/WorkflowSection";
import { WorkflowStepsSection } from "@/src/features/admin/components/WorkflowStepsSection";
import { adminSections, buildApprovalRoutes, type AdminSectionId } from "@/src/features/admin/lib/config";
import { AdminUser, AppUser, ApproverAssignment, CatalogItem, EmployeeProfile, OrgUnit, RequestItem, RequestType, WorkflowStepTemplate } from "@/src/shared/lib/types";

function SectionIcon({ id }: { id: AdminSectionId }) {
  if (id === "overview") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M3 12h18" />
        <path d="M12 3v18" />
      </svg>
    );
  }

  if (id === "catalogs") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    );
  }

  if (id === "departments") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M12 4v5" />
        <path d="M5 10h14" />
        <path d="M7 10v8" />
        <path d="M12 10v8" />
        <path d="M17 10v8" />
        <path d="M4 18h6" />
        <path d="M9 18h6" />
        <path d="M14 18h6" />
      </svg>
    );
  }

  if (id === "workflows") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M5 6h14" />
        <path d="M5 12h9" />
        <path d="M5 18h14" />
        <path d="m15 10 2 2 4-4" />
      </svg>
    );
  }

  if (id === "steps") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M4 6h10" />
        <path d="M4 12h16" />
        <path d="M4 18h8" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="14" cy="18" r="2" />
      </svg>
    );
  }

  if (id === "admins") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 7h18" />
      <path d="M6 12h12" />
      <path d="M9 17h6" />
    </svg>
  );
}

export function AdminPanel({
  currentUser,
  admins,
  approvedMobileLines,
  catalogItems,
  approvers,
  orgUnits,
  employeeProfiles,
  requestTypes,
  stepTemplates
}: {
  currentUser: AppUser;
  admins: AdminUser[];
  approvedMobileLines: RequestItem[];
  catalogItems: CatalogItem[];
  approvers: ApproverAssignment[];
  orgUnits: OrgUnit[];
  employeeProfiles: EmployeeProfile[];
  requestTypes: RequestType[];
  stepTemplates: WorkflowStepTemplate[];
}) {
  const [activeSection, setActiveSection] = useState<AdminSectionId>("overview");
  const [adminList, setAdminList] = useState(admins);
  const [catalogList, setCatalogList] = useState(catalogItems);
  const [approverList, setApproverList] = useState(approvers);
  const [orgUnitList, setOrgUnitList] = useState(orgUnits);
  const [employeeProfileList, setEmployeeProfileList] = useState(employeeProfiles);
  const [requestTypeList, setRequestTypeList] = useState(requestTypes);
  const [stepTemplateList, setStepTemplateList] = useState(stepTemplates);

  const managedDepartments = useMemo(() => {
    const orgDepartments = orgUnitList.filter((item) => item.unit_type === "departamento").map((item) => item.name);
    const liveDepartments = approverList.map((item) => item.department).filter(Boolean) as string[];

    return Array.from(new Set([...orgDepartments, ...liveDepartments])).sort((a, b) => a.localeCompare(b));
  }, [approverList, orgUnitList]);

  const routeCount = useMemo(() => buildApprovalRoutes(managedDepartments, stepTemplateList).length, [managedDepartments, stepTemplateList]);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-[#bfd2e7] bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(234,246,255,0.92)_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#1f406b]">Administracion SSD</div>
            <h2 className="mt-3 text-3xl font-semibold text-[#001534]">Centro de control operativo</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#1e3a5f]">Supervisa la configuracion operativa de SSD desde un panel mas claro y enfocado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#d7e4f2] bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
              {adminList.length} admins
            </span>
            <span className="rounded-full border border-[#d7e4f2] bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
              {managedDepartments.length} departamentos
            </span>
            <span className="rounded-full border border-[#d7e4f2] bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
              {approverList.length} responsables
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3">
          {adminSections.map((section) => {
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`inline-flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-[#0b5ed7] bg-[#0b5ed7] text-white shadow-[0_18px_44px_rgba(11,94,215,0.24)]"
                    : "border-[#d7e4f2] bg-white text-[#1e3a5f] hover:bg-[#f5faff]"
                }`}
              >
                <SectionIcon id={section.id} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeSection === "overview" ? (
        <AdminOverviewSection
          adminCount={adminList.length}
          routeCount={routeCount}
          departmentCount={managedDepartments.length}
          requestTypeCount={requestTypeList.length}
          approvedMobileLineCount={approvedMobileLines.length}
          onNavigate={setActiveSection}
        />
      ) : null}

      {activeSection === "departments" ? (
        <DepartmentOrgChartSection
          currentUser={currentUser}
          orgUnits={orgUnitList}
          approvers={approverList}
          employeeProfiles={employeeProfileList}
          stepTemplates={stepTemplateList}
          onApproversChange={setApproverList}
          onEmployeeProfilesChange={setEmployeeProfileList}
          onOrgUnitsChange={setOrgUnitList}
        />
      ) : null}

      {activeSection === "steps" ? (
        <WorkflowStepsSection
          currentUser={currentUser}
          requestTypes={requestTypeList}
          stepTemplates={stepTemplateList}
          onStepTemplatesChange={setStepTemplateList}
        />
      ) : null}

      {activeSection === "workflows" ? (
        <WorkflowSection
          currentUser={currentUser}
          requestTypes={requestTypeList}
          stepTemplates={stepTemplateList}
          onRequestTypesChange={setRequestTypeList}
        />
      ) : null}

      {activeSection === "catalogs" ? (
        <CatalogSection
          currentUser={currentUser}
          items={catalogList}
          requestTypes={requestTypeList}
          onItemsChange={setCatalogList}
          onRequestTypesChange={setRequestTypeList}
        />
      ) : null}

      {activeSection === "admins" ? (
        <AdminUsersSection currentUser={currentUser} admins={adminList} onAdminsChange={setAdminList} />
      ) : null}

      {activeSection === "mobile" ? <ApprovedLinesSection items={approvedMobileLines} /> : null}
    </section>
  );
}
