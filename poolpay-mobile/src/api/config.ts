/**
 * URL del backend. Cambiar según el entorno:
 *
 * - Emulador Android en la misma PC:  http://10.0.2.2:8000
 * - Emulador iOS en la misma Mac:     http://localhost:8000
 * - Dispositivo físico con ngrok:     https://xxxx.ngrok-free.app
 *
 * Para producción setear la URL real aquí o via variable de entorno.
 */
export const API_BASE_URL = 'http://192.168.1.4:8000'; // IP LAN de la PC. El backend debe correr con --host 0.0.0.0
