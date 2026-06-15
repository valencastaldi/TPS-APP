import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pileteroApi, MyVisit } from '../api/pileteroApi';

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const WA_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  sent:     { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'WA ✓' },
  pending:  { bg: '#1c1403', border: '#d97706', text: '#fbbf24', label: 'Pendiente' },
  failed:   { bg: '#1c0505', border: '#dc2626', text: '#f87171', label: 'WA fallido' },
  no_phone: { bg: '#0f172a', border: '#334155', text: '#64748b', label: 'Sin tel.' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryScreen() {
  const [visits, setVisits] = useState<MyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await pileteroApi.getMyVisits();
      setVisits(data);
    } catch { /* silencio */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Totales del mes actual
  const now = new Date();
  const thisPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthVisits = visits.filter(v => v.visited_at.startsWith(thisPeriod));
  const thisMonthTotal = thisMonthVisits.reduce((acc, v) => acc + v.price, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#64748b' }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis visitas</Text>
        {/* Resumen del mes */}
        <View style={styles.monthCard}>
          <View style={styles.monthStat}>
            <Text style={styles.monthNum}>{thisMonthVisits.length}</Text>
            <Text style={styles.monthLabel}>Este mes</Text>
          </View>
          <View style={styles.monthDivider} />
          <View style={styles.monthStat}>
            <Text style={[styles.monthNum, { color: '#10b981' }]}>{ars(thisMonthTotal)}</Text>
            <Text style={styles.monthLabel}>Total cobrado</Text>
          </View>
        </View>
      </View>

      {visits.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>Todavía no hay visitas registradas.</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          renderItem={({ item: v }) => {
            const wa = WA_STYLES[v.whatsapp_status] ?? WA_STYLES.pending;
            return (
              <View style={styles.card}>
                {/* Fila principal */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardClient}>{v.client_name}</Text>
                    <Text style={styles.cardDate}>{formatDate(v.visited_at)}</Text>
                  </View>
                  <Text style={styles.cardPrice}>{ars(v.price)}</Text>
                </View>

                {/* Detalles */}
                {(v.products_used || v.notes || v.duration_minutes) && (
                  <View style={styles.cardDetails}>
                    {v.duration_minutes && (
                      <Text style={styles.detail}>
                        <Ionicons name="time-outline" size={12} /> {v.duration_minutes} min
                      </Text>
                    )}
                    {v.products_used && (
                      <Text style={styles.detail} numberOfLines={1}>
                        <Ionicons name="flask-outline" size={12} /> {v.products_used}
                      </Text>
                    )}
                    {v.notes && (
                      <Text style={styles.detail} numberOfLines={1}>
                        <Ionicons name="document-text-outline" size={12} /> {v.notes}
                      </Text>
                    )}
                  </View>
                )}

                {/* Footer */}
                <View style={styles.cardFooter}>
                  {/* Badge WA */}
                  <View style={[styles.waBadge, { backgroundColor: wa.bg, borderColor: wa.border }]}>
                    <Text style={[styles.waBadgeText, { color: wa.text }]}>{wa.label}</Text>
                  </View>

                  {/* Botón abrir WA si está pendiente */}
                  {v.whatsapp_status === 'pending' && v.payment_link_url && (
                    <TouchableOpacity
                      style={styles.waBtn}
                      onPress={() => {
                        if (v.payment_link_url) Linking.openURL(v.payment_link_url);
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#4ade80" />
                      <Text style={styles.waBtnText}>Abrir WA</Text>
                    </TouchableOpacity>
                  )}

                  {/* Link factura */}
                  {v.invoice_id && (
                    <Text style={styles.invoiceTag}>Fac. #{v.invoice_id}</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#475569', fontSize: 14 },

  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', marginBottom: 12 },
  monthCard: {
    flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 14,
    borderWidth: 1, borderColor: '#334155', padding: 16, alignItems: 'center',
  },
  monthStat: { flex: 1, alignItems: 'center' },
  monthNum: { color: '#3b82f6', fontSize: 22, fontWeight: '800' },
  monthLabel: { color: '#64748b', fontSize: 12, marginTop: 2 },
  monthDivider: { width: 1, height: 36, backgroundColor: '#334155', marginHorizontal: 12 },

  card: {
    backgroundColor: '#1e293b', borderRadius: 14,
    borderWidth: 1, borderColor: '#334155',
    padding: 14, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardClient: { color: '#f1f5f9', fontWeight: '700', fontSize: 15 },
  cardDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardPrice: { color: '#10b981', fontWeight: '800', fontSize: 17 },

  cardDetails: { gap: 3, marginBottom: 10 },
  detail: { color: '#64748b', fontSize: 12 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  waBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  waBadgeText: { fontSize: 11, fontWeight: '600' },
  waBtn: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: '#052e16', borderRadius: 6, borderWidth: 1,
    borderColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 3,
  },
  waBtnText: { color: '#4ade80', fontSize: 11, fontWeight: '600' },
  invoiceTag: { color: '#475569', fontSize: 11, marginLeft: 'auto' },
});
