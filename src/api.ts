// src/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.API_URL,
});

export async function updateLocation(data: {
  telegramId: number;
  lat: number;
  lng: number;
}) {
  await api.post('specialists/location', data);
}

export async function registerSpecialist(data:{ telegramId: number; name: string }) {
  await api.post('specialists/register', data);
}

export async function specialistOffline(telegramId: number) {
  await api.post('specialists/offline', { telegramId });
}

