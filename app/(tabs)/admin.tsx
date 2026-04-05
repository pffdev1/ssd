import { Text, View } from "react-native";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { WorkflowsSection } from "@/src/features/admin/components/WorkflowsSection";
import { StepsSection } from "@/src/features/admin/components/StepsSection";
import { CatalogsSection } from "@/src/features/admin/components/CatalogsSection";
import { AdminsSection } from "@/src/features/admin/components/AdminsSection";
import { MobileLinesSection } from "@/src/features/admin/components/MobileLinesSection";
import { OverviewSection } from "@/src/features/admin/components/OverviewSection";
import { AdminSectionTabs } from "@/src/features/admin/components/AdminSectionTabs";
import { useAdminScreen } from "@/src/features/admin/hooks/useAdminScreen";

export default function AdminScreen() {
  const state = useAdminScreen();
  const { ui, overview, sections } = state;

  if (ui.loading) {
    return (
      <AppShell title="Administracion SSD" subtitle="Panel central para catalogos, workflows y pasos del sistema.">
        <ScreenSkeletonCard rows={8} />
      </AppShell>
    );
  }

  if (!ui.isAdmin) {
    return (
      <AppShell title="Administracion SSD" subtitle="Panel central para catalogos, workflows y pasos del sistema.">
        <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 14 }}>
          <Text style={{ color: "#0f2440", fontWeight: "700" }}>Sin permisos</Text>
          <Text style={{ marginTop: 4, color: "#475569" }}>No tienes permisos de administrador.</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell title="Administracion SSD" subtitle="Gestiona configuracion operativa y aprobaciones desde un solo panel.">
      <View style={{ gap: 12 }}>
        <View style={{ backgroundColor: "white", borderRadius: 28, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
          <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
            Administracion SSD
          </Text>
          <Text style={{ marginTop: 3, color: "#001534", fontSize: 30, fontWeight: "700" }}>
            Centro de control operativo
          </Text>
          <Text style={{ marginTop: 4, color: "#1e3a5f", lineHeight: 21 }}>
            Calco profundo de catalogos, workflows, pasos y operacion de lineas.
          </Text>
          {ui.error ? <Text style={{ marginTop: 6, color: "#b91c1c" }}>{ui.error}</Text> : null}
          {ui.info ? <Text style={{ marginTop: 6, color: "#475569" }}>{ui.info}</Text> : null}

          <AdminSectionTabs section={ui.section} onChange={ui.setSection} />
        </View>

        {ui.section === "overview" ? (
          <OverviewSection
            routeCount={overview.routeCount}
            departmentCount={overview.departmentCount}
            requestTypeCount={overview.requestTypeCount}
            adminCount={overview.adminCount}
            approvedLinesCount={overview.approvedLinesCount}
            onOpenWorkflows={overview.onOpenWorkflows}
            onOpenCatalogs={overview.onOpenCatalogs}
          />
        ) : null}

        {ui.section === "catalogs" ? (
          <CatalogsSection
            isWide={ui.isWide}
            busy={sections.catalogs.busy}
            catalogViews={sections.catalogs.catalogViews}
            activeCatalogKey={sections.catalogs.activeCatalogKey}
            activeCatalogMode={sections.catalogs.activeCatalogMode}
            requestTypes={sections.catalogs.requestTypes}
            requestTypeId={sections.catalogs.requestTypeId}
            requestTypeCode={sections.catalogs.requestTypeCode}
            requestTypeName={sections.catalogs.requestTypeName}
            requestTypeCategory={sections.catalogs.requestTypeCategory}
            requestTypeDescription={sections.catalogs.requestTypeDescription}
            requestTypeColor={sections.catalogs.requestTypeColor}
            requestTypeFieldsJson={sections.catalogs.requestTypeFieldsJson}
            visibleCatalogItems={sections.catalogs.visibleCatalogItems}
            catalogItemId={sections.catalogs.catalogItemId}
            catalogLabel={sections.catalogs.catalogLabel}
            catalogValue={sections.catalogs.catalogValue}
            catalogSort={sections.catalogs.catalogSort}
            onSelectCatalogView={sections.catalogs.onSelectCatalogView}
            onSelectRequestType={sections.catalogs.onSelectRequestType}
            onRequestTypeCodeChange={sections.catalogs.onRequestTypeCodeChange}
            onRequestTypeNameChange={sections.catalogs.onRequestTypeNameChange}
            onRequestTypeCategoryChange={sections.catalogs.onRequestTypeCategoryChange}
            onRequestTypeDescriptionChange={sections.catalogs.onRequestTypeDescriptionChange}
            onRequestTypeColorChange={sections.catalogs.onRequestTypeColorChange}
            onRequestTypeFieldsJsonChange={sections.catalogs.onRequestTypeFieldsJsonChange}
            onSaveRequestType={sections.catalogs.onSaveRequestType}
            onDeleteRequestType={sections.catalogs.onDeleteRequestType}
            onSelectCatalogItem={sections.catalogs.onSelectCatalogItem}
            onCatalogLabelChange={sections.catalogs.onCatalogLabelChange}
            onCatalogValueChange={sections.catalogs.onCatalogValueChange}
            onCatalogSortChange={sections.catalogs.onCatalogSortChange}
            onSaveCatalogItem={sections.catalogs.onSaveCatalogItem}
          />
        ) : null}

        {ui.section === "workflows" ? (
          <WorkflowsSection
            isWide={ui.isWide}
            busy={sections.workflows.busy}
            requestTypes={sections.workflows.requestTypes}
            workflowTypeId={sections.workflows.workflowTypeId}
            selectedRequestTypeName={sections.workflows.selectedRequestTypeName}
            activeWorkflowSteps={sections.workflows.activeWorkflowSteps}
            availableWorkflowSteps={sections.workflows.availableWorkflowSteps}
            onSelectWorkflowType={sections.workflows.onSelectWorkflowType}
            onMoveStepUp={sections.workflows.onMoveStepUp}
            onMoveStepDown={sections.workflows.onMoveStepDown}
            onRemoveStep={sections.workflows.onRemoveStep}
            onAddStep={sections.workflows.onAddStep}
            onSave={sections.workflows.onSave}
          />
        ) : null}

        {ui.section === "steps" ? (
          <StepsSection
            isWide={ui.isWide}
            busy={sections.steps.busy}
            sortedSteps={sections.steps.sortedSteps}
            selectedStepId={sections.steps.selectedStepId}
            selectedStep={sections.steps.selectedStep}
            createStepCode={sections.steps.createStepCode}
            createStepLabel={sections.steps.createStepLabel}
            createStepDescription={sections.steps.createStepDescription}
            createStepKind={sections.steps.createStepKind}
            createStepRouting={sections.steps.createStepRouting}
            createStepScope={sections.steps.createStepScope}
            createStepSortOrder={sections.steps.createStepSortOrder}
            createStepResponsibleName={sections.steps.createStepResponsibleName}
            createStepResponsibleEmail={sections.steps.createStepResponsibleEmail}
            createStepResponsibleTitle={sections.steps.createStepResponsibleTitle}
            stepLabel={sections.steps.stepLabel}
            stepDescription={sections.steps.stepDescription}
            stepActive={sections.steps.stepActive}
            stepSortOrder={sections.steps.stepSortOrder}
            stepResponsibleName={sections.steps.stepResponsibleName}
            stepResponsibleEmail={sections.steps.stepResponsibleEmail}
            stepResponsibleTitle={sections.steps.stepResponsibleTitle}
            relatedTypesForSelectedStep={sections.steps.relatedTypesForSelectedStep}
            onCreateStepCodeChange={sections.steps.onCreateStepCodeChange}
            onCreateStepLabelChange={sections.steps.onCreateStepLabelChange}
            onCreateStepDescriptionChange={sections.steps.onCreateStepDescriptionChange}
            onCreateStepScopeChange={sections.steps.onCreateStepScopeChange}
            onCreateStepSortOrderChange={sections.steps.onCreateStepSortOrderChange}
            onCreateStepResponsibleNameChange={sections.steps.onCreateStepResponsibleNameChange}
            onCreateStepResponsibleEmailChange={sections.steps.onCreateStepResponsibleEmailChange}
            onCreateStepResponsibleTitleChange={sections.steps.onCreateStepResponsibleTitleChange}
            onToggleCreateStepKind={sections.steps.onToggleCreateStepKind}
            onToggleCreateStepRouting={sections.steps.onToggleCreateStepRouting}
            onCreateStep={sections.steps.onCreateStep}
            onSelectStep={sections.steps.onSelectStep}
            onStepLabelChange={sections.steps.onStepLabelChange}
            onStepDescriptionChange={sections.steps.onStepDescriptionChange}
            onStepSortOrderChange={sections.steps.onStepSortOrderChange}
            onStepResponsibleNameChange={sections.steps.onStepResponsibleNameChange}
            onStepResponsibleEmailChange={sections.steps.onStepResponsibleEmailChange}
            onStepResponsibleTitleChange={sections.steps.onStepResponsibleTitleChange}
            onToggleStepActive={sections.steps.onToggleStepActive}
            onSaveStep={sections.steps.onSaveStep}
            onDeleteStep={sections.steps.onDeleteStep}
            onClearResponsible={sections.steps.onClearResponsible}
            getStepUsageCount={sections.steps.getStepUsageCount}
            getRoutingLabel={sections.steps.getRoutingLabel}
          />
        ) : null}

        {ui.section === "admins" ? (
          <AdminsSection
            busy={sections.admins.busy}
            adminName={sections.admins.adminName}
            adminEmail={sections.admins.adminEmail}
            admins={sections.admins.admins}
            onAdminNameChange={sections.admins.onAdminNameChange}
            onAdminEmailChange={sections.admins.onAdminEmailChange}
            onAddAdmin={sections.admins.onAddAdmin}
          />
        ) : null}

        {ui.section === "mobile" ? (
          <MobileLinesSection
            lines={sections.mobile.lines}
            onOpenResponsiva={sections.mobile.onOpenResponsiva}
            onOpenRequest={sections.mobile.onOpenRequest}
          />
        ) : null}
      </View>
    </AppShell>
  );
}
