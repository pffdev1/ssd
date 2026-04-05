import { Pressable, Text, TextInput, View } from "react-native";
import { CatalogItem, RequestType } from "@/src/lib/types";

type CatalogViewOption<TCatalogKey extends string = string> = {
  key: TCatalogKey;
  mode: "request-types" | "catalog";
  label: string;
  description: string;
};

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  minHeight,
  editable = true
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
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
        minHeight: multiline ? (minHeight ?? 84) : undefined,
        textAlignVertical: multiline ? "top" : "auto",
        backgroundColor: editable ? "#f9fbff" : "#e2e8f0"
      }}
    />
  );
}

type CatalogsSectionProps<TCatalogKey extends string> = {
  isWide: boolean;
  busy: boolean;
  catalogViews: CatalogViewOption<TCatalogKey>[];
  activeCatalogKey: TCatalogKey;
  activeCatalogMode: "request-types" | "catalog";
  requestTypes: RequestType[];
  requestTypeId: string | null;
  requestTypeCode: string;
  requestTypeName: string;
  requestTypeCategory: string;
  requestTypeDescription: string;
  requestTypeColor: string;
  requestTypeFieldsJson: string;
  visibleCatalogItems: CatalogItem[];
  catalogItemId: string | null;
  catalogLabel: string;
  catalogValue: string;
  catalogSort: string;
  onSelectCatalogView: (view: CatalogViewOption<TCatalogKey>) => void;
  onSelectRequestType: (item: RequestType) => void;
  onRequestTypeCodeChange: (value: string) => void;
  onRequestTypeNameChange: (value: string) => void;
  onRequestTypeCategoryChange: (value: string) => void;
  onRequestTypeDescriptionChange: (value: string) => void;
  onRequestTypeColorChange: (value: string) => void;
  onRequestTypeFieldsJsonChange: (value: string) => void;
  onSaveRequestType: () => void | Promise<void>;
  onDeleteRequestType: () => void | Promise<void>;
  onSelectCatalogItem: (item: CatalogItem) => void;
  onCatalogLabelChange: (value: string) => void;
  onCatalogValueChange: (value: string) => void;
  onCatalogSortChange: (value: string) => void;
  onSaveCatalogItem: () => void | Promise<void>;
};

export function CatalogsSection<TCatalogKey extends string>({
  isWide,
  busy,
  catalogViews,
  activeCatalogKey,
  activeCatalogMode,
  requestTypes,
  requestTypeId,
  requestTypeCode,
  requestTypeName,
  requestTypeCategory,
  requestTypeDescription,
  requestTypeColor,
  requestTypeFieldsJson,
  visibleCatalogItems,
  catalogItemId,
  catalogLabel,
  catalogValue,
  catalogSort,
  onSelectCatalogView,
  onSelectRequestType,
  onRequestTypeCodeChange,
  onRequestTypeNameChange,
  onRequestTypeCategoryChange,
  onRequestTypeDescriptionChange,
  onRequestTypeColorChange,
  onRequestTypeFieldsJsonChange,
  onSaveRequestType,
  onDeleteRequestType,
  onSelectCatalogItem,
  onCatalogLabelChange,
  onCatalogValueChange,
  onCatalogSortChange,
  onSaveCatalogItem
}: CatalogsSectionProps<TCatalogKey>) {
  return (
    <View style={{ flexDirection: isWide ? "row" : "column", gap: 10 }}>
      <View
        style={{
          flex: isWide ? 0.8 : undefined,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#bfd2e7",
          backgroundColor: "white",
          padding: 12,
          gap: 8
        }}
      >
        {catalogViews.map((view) => {
          const active = activeCatalogKey === view.key;
          return (
            <Pressable
              key={view.key}
              onPress={() => onSelectCatalogView(view)}
              style={({ hovered, pressed }) => ({
                borderRadius: 18,
                borderWidth: 1,
                borderColor: active ? "#8ebdff" : "#d7e4f2",
                backgroundColor: active ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                padding: 10
              })}
            >
              <Text style={{ color: "#001534", fontWeight: "700" }}>{view.label}</Text>
              <Text style={{ marginTop: 3, color: "#1e3a5f" }}>{view.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          flex: isWide ? 1.2 : undefined,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#bfd2e7",
          backgroundColor: "white",
          padding: 12
        }}
      >
        {activeCatalogMode === "request-types" ? (
          <View style={{ gap: 8 }}>
            {requestTypes.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onSelectRequestType(item)}
                style={({ hovered, pressed }) => ({
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: requestTypeId === item.id ? "#0b5ed7" : "#d7e4f2",
                  backgroundColor: requestTypeId === item.id ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                  padding: 10
                })}
              >
                <Text style={{ color: "#001534", fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ marginTop: 2, color: "#475569" }}>{item.code}</Text>
              </Pressable>
            ))}

            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
              <Field value={requestTypeCode} onChange={onRequestTypeCodeChange} placeholder="Codigo" editable={!requestTypeId} />
              <Field value={requestTypeName} onChange={onRequestTypeNameChange} placeholder="Nombre" />
              <Field value={requestTypeCategory} onChange={onRequestTypeCategoryChange} placeholder="Categoria" />
              <Field value={requestTypeDescription} onChange={onRequestTypeDescriptionChange} placeholder="Descripcion" multiline />
              <Field value={requestTypeColor} onChange={onRequestTypeColorChange} placeholder="#0b5ed7" />
              <Text style={{ color: "#334155", fontWeight: "700" }}>Campos del formulario (JSON)</Text>
              <Field
                value={requestTypeFieldsJson}
                onChange={onRequestTypeFieldsJsonChange}
                placeholder='[{"name":"campo","label":"Campo","type":"text","required":true}]'
                multiline
                minHeight={180}
              />
              <Text style={{ color: "#475569", fontSize: 12, lineHeight: 18 }}>
                Campos del formulario en JSON. Tipos permitidos: text, email, textarea, date, number, dropdown, radio.
              </Text>
              <Text style={{ color: "#64748b", fontSize: 12, lineHeight: 18 }}>
                {'Para dropdown/radio agrega options: [{"option":"Valor"}].'}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    void onSaveRequestType();
                  }}
                  style={{ borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>{requestTypeId ? "Actualizar" : "Crear"}</Text>
                </Pressable>
                {requestTypeId ? (
                  <Pressable
                    onPress={() => {
                      void onDeleteRequestType();
                    }}
                    style={{ borderRadius: 999, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", paddingHorizontal: 12, paddingVertical: 9 }}
                  >
                    <Text style={{ color: "#be123c", fontWeight: "700" }}>Eliminar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {visibleCatalogItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onSelectCatalogItem(item)}
                style={({ hovered, pressed }) => ({
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: catalogItemId === item.id ? "#0b5ed7" : "#d7e4f2",
                  backgroundColor: catalogItemId === item.id ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                  padding: 10
                })}
              >
                <Text style={{ color: "#001534", fontWeight: "700" }}>{item.item_label}</Text>
                <Text style={{ marginTop: 2, color: "#475569" }}>{item.item_value}</Text>
              </Pressable>
            ))}

            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
              <Field value={catalogLabel} onChange={onCatalogLabelChange} placeholder="Etiqueta" />
              <Field value={catalogValue} onChange={onCatalogValueChange} placeholder="Valor" />
              <Field value={catalogSort} onChange={onCatalogSortChange} placeholder="Orden" />

              <Pressable
                onPress={() => {
                  void onSaveCatalogItem();
                }}
                style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>{catalogItemId ? "Actualizar" : "Agregar"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
