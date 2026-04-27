import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const authApi = {
  login: async (username: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const res = await axios.post(`${API_URL}/auth/login`, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.data as { access_token: string; token_type: string; username: string }
  },

  me: async (token: string) => {
    const res = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data as { username: string }
  },
}
