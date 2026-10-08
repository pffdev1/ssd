import { Pressable, Text, TextInput, View } from "react-native";
import { RequestType, WorkflowStepTemplate } from "@/src/lib/types";

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  editable = true
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      editable={editable}
      multiline={multiline}
      style={{
        borderWidth: 1,
        borderColor: "#bfd2e7",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: multiline ? 84 : undefined,
        textAlignVertical: multiline ? "top" : "auto",
        backgroundColor: editable ? "#f9fbff" : "#e2e8f0"
      }}
    />
  );
}

function Badge({ text, tone = "default" }: { text: string; tone?: "default" | "active" | "muted" }) {
  const toneStyle =
    tone === "active"
      ? { borderColor: "#8ebdff", backgroundColor: "#eef5ff", color: "#0b5ed7" }
      : tone === "muted"
        ? { borderColor: "#cbd5e1", backgroundColor: "#f1f5f9", color: "#64748b" }
        : { borderColor: "#d7e4f2", backgroundColor: "white", color: "#1e3a5f" };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: toneStyle.borderColor,
        borderRadius: 999,
        backgroundColor: toneStyle.backgroundColor,
        paddingHorizontal: 9,
        paddingVertical: 4
      }}
    >
      <Text
        style={{
          color: toneStyle.color,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.1,
          fontWeight: "700"
        }}
      >
        {text}
      </Text>
    </View>
  );
}

type StepsSectionProps = {
  isWide: boolean;
  busy: boolean;
  sortedSteps: WorkflowStepTemplate[];
  selectedStepId: string;
  selectedStep: WorkflowStepTemplate | null;
  createStepCode: string;
  createStepLabel: string;
  createStepDescription: string;
  createStepKind: "approval" | "fulfillment";
  createStepRouting: "department" | "scope";
  createStepScope: string;
  createStepSortOrder: string;
  createStepResponsibleName: string;
  createStepResponsibleEmail: string;
  createStepResponsibleTitle: string;
  stepLabel: string;
  stepDescription: string;
  stepActive: boolean;
  stepSortOrder: string;
  stepResponsibleName: string;
  stepResponsibleEmail: string;
  stepResponsibleTitle: string;
  relatedTypesForSelectedStep: RequestType[];
  onCreateStepCodeChange: (value: string) => void;
  onCreateStepLabelChange: (value: string) => void;
  onCreateStepDescriptionChange: (value: string) => void;
  onCreateStepScopeChange: (value: string) => void;
  onCreateStepSortOrderChange: (value: string) => void;
  onCreateStepResponsibleNameChange: (value: string) => void;
  onCreateStepResponsibleEmailChange: (value: string) => void;
  onCreateStepResponsibleTitleChange: (value: string) => void;
  onToggleCreateStepKind: () => void;
  onToggleCreateStepRouting: () => void;
  onCreateStep: () => void | Promise<void>;
  onSelectStep: (stepId: string) => void;
  onStepLabelChange: (value: string) => void;
  onStepDescriptionChange: (value: string) => void;
  onStepSortOrderChange: (value: string) => void;
  onStepResponsibleNameChange: (value: string) => void;
  onStepResponsibleEmailChange: (value: string) => void;
  onStepResponsibleTitleChange: (value: string) => void;
  onToggleStepActive: () => void;
  onSaveStep: () => void | Promise<void>;
  onDeleteStep: () => void | Promise<void>;
  onClearResponsible: () => void | Promise<void>;
  getStepUsageCount: (stepCode: string) => number;
  getRoutingLabel: (step: Pick<WorkflowStepTemplate, "routing" | "scope">) => string;
};

export function StepsSection({
  isWide,
  busy,
  sortedSteps,
  selectedStepId,
  selectedStep,
  createStepCode,
  createStepLabel,
  createStepDescription,
  createStepKind,
  createStepRouting,
  createStepScope,
  createStepSortOrder,
  createStepResponsibleName,
  createStepResponsibleEmail,
  createStepResponsibleTitle,
  stepLabel,
  stepDescription,
  stepActive,
  stepSortOrder,
  stepResponsibleName,
  stepResponsibleEmail,
  stepResponsibleTitle,
  relatedTypesForSelectedStep,
  onCreateStepCodeChange,
  onCreateStepLabelChange,
  onCreateStepDescriptionChange,
  onCreateStepScopeChange,
  onCreateStepSortOrderChange,
  onCreateStepResponsibleNameChange,
  onCreateStepResponsibleEmailChange,
  onCreateStepResponsibleTitleChange,
  onToggleCreateStepKind,
  onToggleCreateStepRouting,
  onCreateStep,
  onSelectStep,
  onStepLabelChange,
  onStepDescriptionChange,
  onStepSortOrderChange,
  onStepResponsibleNameChange,
  onStepResponsibleEmailChange,
  onStepResponsibleTitleChange,
  onToggleStepActive,
  onSaveStep,
  onDeleteStep,
  onClearResponsible,
  getStepUsageCount,
  getRoutingLabel
}: StepsSectionProps) {
  return (
    <View style={{ flexDirection: isWide ? "row" : "column", gap: 10 }}>
      <View
        style={{
          flex: isWide ? 0.82 : undefined,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#bfd2e7",
          backgroundColor: "white",
          padding: 12,
          gap: 8
        }}
      >
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#d7e4f2",
            backgroundColor: "#f9fbff",
            padding: 10,
            gap: 8
          }}
        >
          <Text style={{ color: "#001534", fontWeight: "700" }}>Crear nuevo paso</Text>
          <Field value={createStepCode} onChange={onCreateStepCodeChange} placeholder="Codigo" />
          <Field value={createStepLabel} onChange={onCreateStepLabelChange} placeholder="Etiqueta" />
          <Field value={createStepDescription} onChange={onCreateStepDescriptionChange} placeholder="Descripcion" multiline />
          <Field value={createStepScope} onChange={onCreateStepScopeChange} placeholder="Scope" editable={createStepRouting === "scope"} />
          <Field value={createStepSortOrder} onChange={onCreateStepSortOrderChange} placeholder="Orden" />
          <Field value={createStepResponsibleName} onChange={onCreateStepResponsibleNameChange} placeholder="Responsable nombre" />
          <Field value={createStepResponsibleEmail} onChange={onCreateStepResponsibleEmailChange} placeholder="Responsable correo" />
          <Field value={createStepResponsibleTitle} onChange={onCreateStepResponsibleTitleChange} placeholder="Responsable cargo" />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={onToggleCreateStepKind}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                paddingHorizontal: 10,
                paddingVertical: 6
              }}
            >
              <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Tipo: {createStepKind}</Text>
            </Pressable>
            <Pressable
              onPress={onToggleCreateStepRouting}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                paddingHorizontal: 10,
                paddingVertical: 6
              }}
            >
              <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Ruteo: {createStepRouting}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              void onCreateStep();
            }}
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              backgroundColor: busy ? "#94a3b8" : "#0b5ed7",
              paddingHorizontal: 12,
              paddingVertical: 9
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Crear paso</Text>
          </Pressable>
        </View>

        {sortedSteps.map((step) => (
          <Pressable
            key={step.id}
            onPress={() => onSelectStep(step.id)}
            style={({ hovered, pressed }) => ({
              borderRadius: 18,
              borderWidth: 1,
              borderColor: selectedStepId === step.id ? "#8ebdff" : "#d7e4f2",
              backgroundColor: selectedStepId === step.id ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
              padding: 10
            })}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#001534", fontWeight: "700" }}>{step.label}</Text>
                <Text style={{ marginTop: 2, color: "#475569" }}>{step.description}</Text>
              </View>
              <View style={{ gap: 4 }}>
                <Badge text={step.active ? "Activo" : "Inactivo"} tone={step.active ? "active" : "muted"} />
                <Badge text={`${getStepUsageCount(step.code)} flujos`} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <View
        style={{
          flex: isWide ? 1.18 : undefined,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#bfd2e7",
          backgroundColor: "white",
          padding: 12,
          gap: 8
        }}
      >
        {selectedStep ? (
          <>
            <Text style={{ color: "#001534", fontSize: 20, fontWeight: "700" }}>{selectedStep.label}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Badge text={selectedStep.kind} />
              <Badge text={getRoutingLabel(selectedStep)} />
              <Badge text={selectedStep.active ? "Activo" : "Inactivo"} tone={selectedStep.active ? "active" : "muted"} />
            </View>

            <Field value={stepLabel} onChange={onStepLabelChange} placeholder="Etiqueta" />
            <Field value={stepDescription} onChange={onStepDescriptionChange} placeholder="Descripcion" multiline />
            <Field value={stepSortOrder} onChange={onStepSortOrderChange} placeholder="Orden" />
            <Field value={stepResponsibleName} onChange={onStepResponsibleNameChange} placeholder="Responsable nombre" />
            <Field value={stepResponsibleEmail} onChange={onStepResponsibleEmailChange} placeholder="Responsable correo" />
            <Field value={stepResponsibleTitle} onChange={onStepResponsibleTitleChange} placeholder="Responsable cargo" />
            <Pressable
              onPress={onToggleStepActive}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                paddingHorizontal: 10,
                paddingVertical: 7
              }}
            >
              <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Activo: {stepActive ? "Si" : "No"}</Text>
            </Pressable>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => {
                  void onSaveStep();
                }}
                style={{
                  borderRadius: 999,
                  backgroundColor: busy ? "#94a3b8" : "#0b5ed7",
                  paddingHorizontal: 12,
                  paddingVertical: 9
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Guardar paso</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void onDeleteStep();
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#fecdd3",
                  backgroundColor: "#fff1f2",
                  paddingHorizontal: 12,
                  paddingVertical: 9
                }}
              >
                <Text style={{ color: "#be123c", fontWeight: "700" }}>Eliminar</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void onClearResponsible();
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#fde68a",
                  backgroundColor: "#fffbeb",
                  paddingHorizontal: 12,
                  paddingVertical: 9
                }}
              >
                <Text style={{ color: "#b45309", fontWeight: "700" }}>Limpiar responsable</Text>
              </Pressable>
            </View>

            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
              <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Uso actual</Text>
              <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {relatedTypesForSelectedStep.map((item) => (
                  <View
                    key={`${selectedStep.code}-${item.code}`}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "#d7e4f2",
                      backgroundColor: "white",
                      paddingHorizontal: 9,
                      paddingVertical: 5
                    }}
                  >
                    <Text style={{ color: "#1e3a5f", fontSize: 12 }}>{item.name}</Text>
                  </View>
                ))}
                {relatedTypesForSelectedStep.length === 0 ? <Text style={{ color: "#475569" }}>Sin uso en workflows.</Text> : null}
              </View>
            </View>
          </>
        ) : (
          <Text style={{ color: "#475569" }}>No hay pasos disponibles.</Text>
        )}
      </View>
    </View>
  );
}
