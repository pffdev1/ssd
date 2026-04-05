import { Pressable, Text, View } from "react-native";
import { RequestType, WorkflowStepTemplate } from "@/src/lib/types";

type WorkflowsSectionProps = {
  isWide: boolean;
  busy: boolean;
  requestTypes: RequestType[];
  workflowTypeId: string;
  selectedRequestTypeName: string | null;
  activeWorkflowSteps: WorkflowStepTemplate[];
  availableWorkflowSteps: WorkflowStepTemplate[];
  legacyWorkflowCount: number;
  onSelectWorkflowType: (requestTypeId: string) => void;
  onMoveStepUp: (index: number) => void;
  onMoveStepDown: (index: number) => void;
  onRemoveStep: (stepCode: string) => void;
  onAddStep: (stepCode: string) => void;
  onSave: () => void | Promise<void>;
  onSanitizeLegacyWorkflows: () => void | Promise<void>;
};

export function WorkflowsSection({
  isWide,
  busy,
  requestTypes,
  workflowTypeId,
  selectedRequestTypeName,
  activeWorkflowSteps,
  availableWorkflowSteps,
  legacyWorkflowCount,
  onSelectWorkflowType,
  onMoveStepUp,
  onMoveStepDown,
  onRemoveStep,
  onAddStep,
  onSave,
  onSanitizeLegacyWorkflows
}: WorkflowsSectionProps) {
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
        {requestTypes.map((item) => {
          const active = workflowTypeId === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => onSelectWorkflowType(item.id)}
              style={({ hovered, pressed }) => ({
                borderRadius: 18,
                borderWidth: 1,
                borderColor: active ? "#8ebdff" : "#d7e4f2",
                backgroundColor: active ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                padding: 10
              })}
            >
              <Text style={{ color: "#001534", fontWeight: "700" }}>{item.name}</Text>
              <Text style={{ marginTop: 3, color: "#475569" }}>{item.description}</Text>
            </Pressable>
          );
        })}
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
        <Text style={{ color: "#001534", fontSize: 20, fontWeight: "700" }}>
          {selectedRequestTypeName ?? "Sin tipo seleccionado"}
        </Text>

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
          <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Secuencia actual</Text>
          {activeWorkflowSteps.map((step, index) => (
            <View
              key={`${step.id}-${index}`}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#d7e4f2",
                backgroundColor: "white",
                padding: 9
              }}
            >
              <Text style={{ color: "#001534", fontWeight: "700" }}>{step.label}</Text>
              <Text style={{ color: "#475569", marginTop: 2 }}>{step.description}</Text>
              <View style={{ marginTop: 6, flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Pressable
                  onPress={() => onMoveStepUp(index)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "#bfd2e7",
                    backgroundColor: "white",
                    paddingHorizontal: 8,
                    paddingVertical: 5
                  }}
                >
                  <Text style={{ color: "#1e3a5f", fontSize: 12 }}>Subir</Text>
                </Pressable>

                <Pressable
                  onPress={() => onMoveStepDown(index)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "#bfd2e7",
                    backgroundColor: "white",
                    paddingHorizontal: 8,
                    paddingVertical: 5
                  }}
                >
                  <Text style={{ color: "#1e3a5f", fontSize: 12 }}>Bajar</Text>
                </Pressable>

                <Pressable
                  onPress={() => onRemoveStep(step.code)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "#fecdd3",
                    backgroundColor: "#fff1f2",
                    paddingHorizontal: 8,
                    paddingVertical: 5
                  }}
                >
                  <Text style={{ color: "#be123c", fontSize: 12 }}>Quitar</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {activeWorkflowSteps.length === 0 ? (
            <Text style={{ color: "#475569" }}>
              Esta solicitud no tiene pasos adicionales. Se aprobara solo con la jefatura inmediata.
            </Text>
          ) : null}
        </View>

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
          <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Agregar paso</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {availableWorkflowSteps.map((step) => (
              <Pressable
                key={step.id}
                onPress={() => onAddStep(step.code)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  backgroundColor: "white",
                  paddingHorizontal: 9,
                  paddingVertical: 5
                }}
              >
                <Text style={{ color: "#334155", fontSize: 12 }}>{step.code}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => {
              void onSave();
            }}
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              backgroundColor: busy ? "#94a3b8" : "#0b5ed7",
              paddingHorizontal: 12,
              paddingVertical: 9
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Guardar workflow</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pressable
              onPress={() => {
                void onSanitizeLegacyWorkflows();
              }}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#f5c76a",
                backgroundColor: busy ? "#f1f5f9" : "#fff7e6",
                paddingHorizontal: 12,
                paddingVertical: 9
              }}
            >
              <Text style={{ color: "#8a5a00", fontWeight: "700" }}>Sanear workflows legacy</Text>
            </Pressable>
            <Text style={{ color: "#64748b", fontSize: 12 }}>
              {legacyWorkflowCount > 0
                ? `${legacyWorkflowCount} tipo(s) con IMMEDIATE_LEAD legacy detectado(s).`
                : "No hay workflows legacy detectados."}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
