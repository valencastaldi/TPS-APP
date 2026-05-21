import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
  Modal, FlatList, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { pileteroApi, ClientMapItem, ServiceVisitOut } from '../api/pileteroApi';

export default function RegisterVisitScreen() {
  const [clients, setClients] = useState<ClientMapItem[]>([]);
  const [filtered, setFiltered] = useState<ClientMapItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientMapItem | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [products, setProducts] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [paidCash, setPaidCash] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<ServiceVisitOut | null>(null);

  const loadClients = useCallback(async () => {
    try {
      const c = await pileteroApi.getClients();
      setClients(c);
    } catch { /* sin conexión, mantener lista actual */ }
  }, []);

  // Recargar la lista cada vez que se entra a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  }, [loadClients]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.neighborhood ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q)
      ) : clients
    );
  }, [search, clients]);

  const handleSubmit = async () => {
    if (!selectedClient) {
      Alert.alert('Falta el cliente', 'Seleccioná el cliente antes de registrar.');
      return;
    }
    setLoading(true);
    try {
      // Intentar obtener GPS para guardar coords del cliente
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch { /* GPS no disponible, continúa igual */ }

      const payload: Parameters<typeof pileteroApi.createVisit>[0] = {
        client_id: selectedClient.id,
        products_used: products.trim() || undefined,
        notes: notes.trim() || undefined,
        duration_minutes: duration ? parseInt(duration) : undefined,
        price: priceOverride ? parseFloat(priceOverride) : undefined,
        paid_cash: paidCash,
      };

      const visit = await pileteroApi.createVisit(payload);
      setResult(visit);

      // Guardar coords GPS si las obtuvimos
      if (lat && lng) {
        pileteroApi.updateClientCoords(selectedClient.id, lat, lng).catch(() => {});
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'No se pudo registrar la visita. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewVisit = () => {
    setResult(null);
    setSelectedClient(null);
    setProducts('');
    setNotes('');
    setDuration('');
    setPriceOverride('');
    setPaidCash(false);
    setSearch('');
  };

  // ── Pantalla de resultado ────────────────────────────────────────────────
  if (result) {
    return (
      <View style={styles.container}>
        <View style={styles.resultHeader}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark-circle" size={56} color="#10b981" />
          </View>
          <Text style={styles.resultTitle}>¡Visita registrada!</Text>
          <Text style={styles.resultSub}>{result.client_name}</Text>
        </View>

        <View style={styles.resultCard}>
          <ResultRow icon="receipt-outline" label="Factura" value={`#${result.invoice_id}`} />
          <ResultRow icon="cash-outline" label="Monto" value={`$${result.price.toLocaleString('es-AR')}`} />
          <ResultRow
            icon={result.paid_cash ? 'checkmark-circle-outline' : 'time-outline'}
            label="Pago"
            value={result.paid_cash ? 'Pagado en efectivo' : 'Pendiente'}
            valueColor={result.paid_cash ? '#10b981' : '#f59e0b'}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#64748b" />
          <Text style={styles.infoText}>
            {result.paid_cash
              ? 'Registraste el pago en efectivo. La factura quedó saldada.'
              : 'El cobro se gestiona desde el panel. No tenés que contactar al cliente.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.newVisitBtn} onPress={handleNewVisit}>
          <Text style={styles.newVisitText}>Registrar otra visita</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Registrar visita</Text>
        <Text style={styles.formSub}>Completá los datos de la limpieza que terminaste.</Text>
      </View>

      {/* Selector de cliente */}
      <View style={styles.section}>
        <Text style={styles.label}>Cliente *</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowPicker(true)}>
          {selectedClient ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerSelected}>{selectedClient.name}</Text>
              {selectedClient.address && (
                <Text style={styles.pickerSub}>{selectedClient.address}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.pickerPlaceholder}>Tocar para seleccionar cliente…</Text>
          )}
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Precio override */}
      <View style={styles.section}>
        <Text style={styles.label}>
          Precio{selectedClient ? ` (default: $${selectedClient.price.toLocaleString('es-AR')})` : ''}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Dejar vacío para usar precio default"
          placeholderTextColor="#475569"
          value={priceOverride}
          onChangeText={setPriceOverride}
          keyboardType="numeric"
        />
      </View>

      {/* Duración */}
      <View style={styles.section}>
        <Text style={styles.label}>Duración (minutos)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 45"
          placeholderTextColor="#475569"
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
        />
      </View>

      {/* Productos */}
      <View style={styles.section}>
        <Text style={styles.label}>Productos usados</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Cloro 2L, Alguicida 1L"
          placeholderTextColor="#475569"
          value={products}
          onChangeText={setProducts}
        />
      </View>

      {/* Notas */}
      <View style={styles.section}>
        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Ej: Filtros sucios, sugerir cambio"
          placeholderTextColor="#475569"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Pago en efectivo */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.cashRow, paidCash && styles.cashRowActive]}
          onPress={() => setPaidCash(!paidCash)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, paidCash && styles.checkboxActive]}>
            {paidCash && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cashTitle}>Pagó en efectivo</Text>
            <Text style={styles.cashSub}>
              Marcá esto si el cliente te pagó en el momento. La factura queda saldada.
            </Text>
          </View>
          <Ionicons name="cash-outline" size={22} color={paidCash ? '#10b981' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {/* Botón registrar */}
      <TouchableOpacity
        style={[styles.submitBtn, (!selectedClient || loading) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!selectedClient || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitText}>Registrar visita</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* Modal selector de cliente */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar cliente</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o barrio…"
              placeholderTextColor="#475569"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.clientItem}
                onPress={() => {
                  setSelectedClient(item);
                  setShowPicker(false);
                  setSearch('');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientItemName}>{item.name}</Text>
                  <Text style={styles.clientItemSub}>
                    {[item.neighborhood, item.address].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.clientItemPrice}>${item.price.toLocaleString('es-AR')}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

function ResultRow({ icon, label, value, valueColor }: {
  icon: string; label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={styles.resultRow}>
      <Ionicons name={icon as any} size={16} color="#64748b" />
      <Text style={styles.resultRowLabel}>{label}</Text>
      <Text style={[styles.resultRowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  formHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  formTitle: { color: '#f1f5f9', fontSize: 26, fontWeight: '800' },
  formSub: { color: '#64748b', fontSize: 13, marginTop: 4 },

  section: { paddingHorizontal: 20, marginTop: 18 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.4 },

  picker: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1, borderColor: '#334155', padding: 14,
  },
  pickerSelected: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  pickerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  pickerPlaceholder: { color: '#475569', fontSize: 14, flex: 1 },

  input: {
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1, borderColor: '#334155',
    color: '#f1f5f9', fontSize: 14, padding: 14,
  },
  inputMulti: { minHeight: 90, paddingTop: 14 },

  submitBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 16,
    marginHorizontal: 20, marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Resultado
  resultHeader: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingHorizontal: 20 },
  resultIcon: { marginBottom: 16 },
  resultTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '800' },
  resultSub: { color: '#64748b', fontSize: 16, marginTop: 4 },

  resultCard: {
    backgroundColor: '#1e293b', borderRadius: 16,
    borderWidth: 1, borderColor: '#334155',
    marginHorizontal: 20, marginTop: 28, padding: 16,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  resultRowLabel: { color: '#64748b', flex: 1, fontSize: 14 },
  resultRowValue: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#334155',
    marginHorizontal: 20, marginTop: 16,
  },
  infoText: { color: '#94a3b8', fontSize: 13, flex: 1, lineHeight: 18 },

  cashRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1, borderColor: '#334155', padding: 14,
  },
  cashRowActive: { borderColor: '#10b981' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  cashTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  cashSub: { color: '#64748b', fontSize: 12, marginTop: 2, lineHeight: 16 },

  newVisitBtn: {
    alignItems: 'center', marginHorizontal: 20, marginTop: 14, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#334155',
  },
  newVisitText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  modalTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', margin: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 14, paddingVertical: 12 },
  clientItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  clientItemName: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  clientItemSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  clientItemPrice: { color: '#10b981', fontWeight: '700', fontSize: 14 },
  separator: { height: 1, backgroundColor: '#1e293b', marginHorizontal: 20 },
});
