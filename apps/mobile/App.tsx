import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  View
} from "react-native";

import "./global.css";
import type { Client, ClientDraft, ClientType } from "./src/domain/client";
import { validateClient } from "./src/domain/client";
import { listClients, saveClient } from "./src/storage/client-repository";

const emptyDraft: ClientDraft = {
  name: "",
  type: "PF",
  document: "",
  phone: "",
  email: "",
  address: "",
  notes: ""
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  multiline?: boolean;
};

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline }: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-nexus-ink">{label}</Text>
      <TextInput
        className={`rounded-xl border border-nexus-border bg-white px-4 py-3 text-base text-nexus-ink ${multiline ? "min-h-24" : ""}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => Alert.alert("Não foi possível carregar os clientes."))
      .finally(() => setIsLoading(false));
  }, []);

  function updateDraft<Field extends keyof ClientDraft>(field: Field, value: ClientDraft[Field]) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  async function createClient() {
    const validationError = validateClient(draft);
    if (validationError) {
      Alert.alert("Revise o cadastro", validationError);
      return;
    }

    setIsSaving(true);
    try {
      const client: Client = {
        ...draft,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };

      const nextClients = await saveClient(client);
      setClients(nextClients);
      setDraft(emptyDraft);
      setIsFormOpen(false);
    } catch {
      Alert.alert("Não foi possível salvar", "Tente novamente. Se o problema continuar, avise o administrador.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="light-content" />
      <View className="bg-nexus-ink px-6 pb-6 pt-5">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-nexus-primary">
            <Text className="text-2xl font-bold text-white">N</Text>
          </View>
          <View>
            <Text className="text-xl font-bold text-white">NEXUS</Text>
            <Text className="text-xs tracking-wider text-slate-300">CONSTRUÇÃO E REFORMAS</Text>
          </View>
        </View>
        <Text className="mt-6 text-2xl font-bold text-white">Clientes</Text>
        <Text className="mt-1 text-base text-slate-300">A pasta central para cada obra e serviço.</Text>
      </View>

      <View className="flex-1 px-5 pt-5">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FF7A00" />
          </View>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(client) => client.id}
            contentContainerClassName={clients.length === 0 ? "flex-grow" : "pb-28"}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-2xl border border-nexus-border bg-white p-4">
                <Text className="text-base font-semibold text-nexus-ink">{item.name}</Text>
                <Text className="mt-1 text-sm text-nexus-muted">{item.phone}</Text>
                {item.document ? <Text className="mt-1 text-sm text-nexus-muted">{item.document}</Text> : null}
              </View>
            )}
            ListEmptyComponent={() => (
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-center text-xl font-semibold text-nexus-ink">Nenhum cliente cadastrado</Text>
                <Text className="mt-2 text-center text-base leading-6 text-nexus-muted">
                  Cadastre o primeiro cliente para começar a organizar obras, serviços e documentos.
                </Text>
              </View>
            )}
          />
        )}
      </View>

      <Pressable
        className="absolute bottom-7 right-5 rounded-xl bg-nexus-primary px-5 py-4 shadow-lg"
        onPress={() => setIsFormOpen(true)}
      >
        <Text className="font-semibold text-white">+ Novo cliente</Text>
      </Pressable>

      <Modal animationType="slide" visible={isFormOpen} onRequestClose={() => setIsFormOpen(false)}>
        <SafeAreaView className="flex-1 bg-slate-50">
          <View className="flex-row items-center justify-between border-b border-nexus-border bg-white px-5 py-4">
            <Text className="text-xl font-bold text-nexus-ink">Novo cliente</Text>
            <Pressable onPress={() => setIsFormOpen(false)}>
              <Text className="font-semibold text-nexus-muted">Cancelar</Text>
            </Pressable>
          </View>
          <FlatList
            data={["form"]}
            keyExtractor={(item) => item}
            contentContainerClassName="p-5 pb-10"
            renderItem={() => (
              <>
                <Text className="mb-2 text-sm font-medium text-nexus-ink">Tipo de cliente</Text>
                <View className="mb-5 flex-row gap-3">
                  {(["PF", "PJ"] as ClientType[]).map((type) => (
                    <Pressable
                      className={`flex-1 rounded-xl border px-4 py-3 ${draft.type === type ? "border-nexus-primary bg-orange-50" : "border-nexus-border bg-white"}`}
                      key={type}
                      onPress={() => updateDraft("type", type)}
                    >
                      <Text className={`text-center font-semibold ${draft.type === type ? "text-nexus-dark" : "text-nexus-muted"}`}>
                        {type === "PF" ? "Pessoa física" : "Pessoa jurídica"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Field label="Nome ou razão social *" value={draft.name} onChangeText={(value) => updateDraft("name", value)} placeholder="Digite o nome" />
                <Field label={draft.type === "PF" ? "CPF" : "CNPJ"} value={draft.document} onChangeText={(value) => updateDraft("document", value)} placeholder={draft.type === "PF" ? "000.000.000-00" : "00.000.000/0000-00"} keyboardType="phone-pad" />
                <Field label="Telefone *" value={draft.phone} onChangeText={(value) => updateDraft("phone", value)} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
                <Field label="E-mail" value={draft.email} onChangeText={(value) => updateDraft("email", value)} placeholder="cliente@email.com" keyboardType="email-address" />
                <Field label="Endereço" value={draft.address} onChangeText={(value) => updateDraft("address", value)} placeholder="Rua, número, bairro e cidade" />
                <Field label="Observações" value={draft.notes} onChangeText={(value) => updateDraft("notes", value)} placeholder="Informações importantes do cliente" multiline />
                <Pressable className="mt-2 items-center rounded-xl bg-nexus-primary px-5 py-4" disabled={isSaving} onPress={createClient}>
                  {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-semibold text-white">Salvar cliente</Text>}
                </Pressable>
              </>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
