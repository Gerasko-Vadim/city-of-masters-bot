// src/api.ts
import axios from 'axios';
import type { Order, RegisterSpecialistDto, UpdateLocationDto } from './types';

export const api = axios.create({
  baseURL: process.env.API_URL,
});

export async function updateLocation(data: UpdateLocationDto): Promise<void> {
  await api.post('specialists/location', data);
}

export async function registerSpecialist(data: RegisterSpecialistDto): Promise<void> {
  await api.post('specialists/register', data);
}

export async function getOrdersNearby(telegramId: number): Promise<Order[]> {
  const response = await api.get<Order[]>('specialists/orders/nearby', {
    params: { telegramId },
  });
  return response.data;
}

export async function specialistOffline(telegramId: number): Promise<void> {
  await api.post('specialists/offline', { telegramId });
}


