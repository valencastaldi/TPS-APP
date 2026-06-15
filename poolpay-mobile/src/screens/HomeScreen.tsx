import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { pileteroApi, ClientMapItem, MyVisit, RouteToday } from '../api/pileteroApi';

const DAYS_ES: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};

const TODAY_ES: Record<number, string> = {
  0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles',
  4: 'jueves', 5: 'viernes', 6: 'sabado',
};

function isClientToday(client: ClientMapItem): boolean {
  if (!client.assigned_days) return false;
  const today = TODAY_ES[new Date().getDay()];
  return client.assigned_days.toLowerCase().split(',').map(d => d.trim()).includes(today);
}

function formatDay(assigned_days: string | null) {
  if (!assigned_days) return null;
  return assigned_days.split(',').map(d => DAYS_ES[d.trim().toLowerCase()] ?? d.trim()).join(' · ');
}

function buildLeafletHTML(clients: ClientMapItem[], todayIds: Set<number>, userLat?: number, userLng?: number): string {
  const markers = clients
    .filter(c => c.lat && c.lng)
    .map(c => {
      const color = todayIds.has(c.id) ? '#3b82f6' : '#64748b';
      const popup = `${c.name}${c.address ? '<br/>' + c.address : ''}${c.neighborhood ? '<br/>📍 ' + c.neighborhood : ''}`;
      return `
        L.circleMarker([${c.lat}, ${c.lng}], {
          radius: 10, color: '${color}', fillColor: '${color}',
          fillOpacity: 0.9, weight: 2
        }).addTo(map).bindPopup('${popup.replace(/'/g, "\\'")}');
      `;
    }).join('\n');

  const centerLat = userLat ?? (clients.find(c => c.lat)?.lat ?? -32.9468);
  const centerLng = userLng ?? (clients.find(c => c.lng)?.lng ?? -60.6393);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; background: #0f172a; }
    #map { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    ${userLat && userLng ? `
    L.circleMarker([${userLat}, ${userLng}], {
      radius: 8, color: '#10b981', fillColor: '#10b981', fillOpacity: 1, weight: 2
    }).addTo(map).bindPopup('Tu ubicación');
    ` : ''}
    ${markers}
  </script>
</body>
</html>`;
}

export default function HomeScreen() {
  const { profile, logout } = useAuth();
  const [clients, setClients] = useState<ClientMapItem[]>([]);
  const [route, setRoute] = useState<RouteToday | null>(null);
  const [recentVisits, setRecentVisits] = useState<MyVisit[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const load = useCallback(async () => {
    try {
      const [cls, visits, rt] = await Promise.all([
        pileteroApi.getClients(),
        pileteroApi.getMyVisits(),
        pileteroApi.getRouteToday(),
      ]);
      setClients(cls);
      setRecentVisits(visits.slice(0, 5));
      setRoute(rt);
    } catch { /* silencio */ }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const todayClients = route?.clients ?? [];
  const todayIds = new Set(todayClients.map(c => c.id));
  const mappableClients = clients.filter(c => c.lat && c.lng);

  const mapHtml = buildLeafletHTML(clients, todayIds, userLocation?.lat, userLocation?.lng);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{dateStr}</Text>
          <Text style={styles.greetText}>Hola, {profile?.name?.split(' ')[0]} 👋</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{todayClients.length}</Text>
          <Text style={styles.statLabel}>Piletas hoy</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{recentVisits.length}</Text>
          <Text style={styles.statLabel}>Últimas visitas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{clients.length}</Text>
          <Text style={styles.statLabel}>Total clientes</Text>
        </View>
      </View>

      {/* Mapa Leaflet */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="map-outline" size={16} color="#3b82f6" /> Mapa de piletas
        </Text>
        <View style={styles.mapContainer}>
          {mappableClients.length === 0 ? (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={36} color="#334155" />
              <Text style={styles.mapPlaceholderText}>
                Los clientes aparecerán aquí cuando{'\n'}el admin cargue sus coordenadas.
              </Text>
            </View>
          ) : (
            <WebView
              style={styles.map}
              source={{ html: mapHtml }}
              originWhitelist={['*']}
              javaScriptEnabled
              scrollEnabled={false}
            />
          )}
        </View>
      </View>

      {/* Ruta de hoy */}
      {todayClients.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="today-outline" size={16} color="#10b981" /> Ruta de hoy ({todayClients.length})
          </Text>
          {route && route.neighborhoods.length > 0 && (
            <View style={styles.chipsRow}>
              {route.neighborhoods.map(n => (
                <View key={n} style={styles.chip}>
                  <Text style={styles.chipText}>📍 {n}</Text>
                </View>
              ))}
            </View>
          )}
          {todayClients.map(c => (
            <View key={c.id} style={styles.clientCard}>
              <View style={styles.clientCardLeft}>
                <Text style={styles.clientName}>{c.name}</Text>
                {c.address && <Text style={styles.clientSub}>{c.address}</Text>}
                {c.neighborhood && <Text style={styles.clientSub}>📍 {c.neighborhood}</Text>}
              </View>
              <View style={styles.clientCardRight}>
                <Text style={styles.clientPrice}>${c.price.toLocaleString('es-AR')}</Text>
                <Text style={styles.clientPlan}>{c.plan}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="today-outline" size={16} color="#10b981" /> Ruta de hoy
          </Text>
          <View style={styles.emptyRoute}>
            <Ionicons name="calendar-clear-outline" size={28} color="#334155" />
            <Text style={styles.emptyRouteText}>
              No hay ruta cargada para hoy.{'\n'}El admin la asigna desde el panel.
            </Text>
          </View>
        </View>
      )}

      {/* Últimas visitas */}
      {recentVisits.length > 0 && (
        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time-outline" size={16} color="#f59e0b" /> Mis últimas visitas
          </Text>
          {recentVisits.map(v => (
            <View key={v.id} style={styles.visitCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitClient}>{v.client_name}</Text>
                <Text style={styles.visitDate}>
                  {new Date(v.visited_at).toLocaleDateString('es-AR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.visitPrice}>${v.price.toLocaleString('es-AR')}</Text>
                <WaBadge status={v.whatsapp_status} />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function WaBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    sent:     { color: '#10b981', label: 'WA enviado' },
    pending:  { color: '#f59e0b', label: 'WA pendiente' },
    failed:   { color: '#ef4444', label: 'WA fallido' },
    no_phone: { color: '#64748b', label: 'Sin teléfono' },
  };
  const s = map[status] ?? map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: s.color + '22', borderColor: s.color }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  dateText: { color: '#64748b', fontSize: 13, textTransform: 'capitalize' },
  greetText: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginTop: 2 },
  logoutBtn: { padding: 8, marginTop: 8 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center',
  },
  statNum: { color: '#3b82f6', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 2, textAlign: 'center' },

  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  mapContainer: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', height: 240 },
  map: { flex: 1, backgroundColor: '#1e293b' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#1e293b' },
  mapPlaceholderText: { color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: '#1e293b', borderRadius: 999,
    borderWidth: 1, borderColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },

  emptyRoute: {
    backgroundColor: '#1e293b', borderRadius: 14, padding: 24,
    borderWidth: 1, borderColor: '#334155', alignItems: 'center', gap: 10,
  },
  emptyRouteText: { color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  clientCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#1e293b', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#334155',
  },
  clientCardLeft: { flex: 1 },
  clientName: { color: '#f1f5f9', fontWeight: '600', fontSize: 15 },
  clientSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  clientCardRight: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 12 },
  clientPrice: { color: '#10b981', fontWeight: '700', fontSize: 16 },
  clientPlan: { color: '#64748b', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },

  visitCard: {
    flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 14,
    padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155',
  },
  visitClient: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  visitDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  visitPrice: { color: '#10b981', fontWeight: '700', fontSize: 15 },

  badge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    marginTop: 4, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
});
