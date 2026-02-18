// src/api.ts
import axios from 'axios';
import type { Order, RegisterSpecialistDto, UpdateLocationDto } from './types';

export const api = axios.create({
  baseURL: process.env.API_URL,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403) {
      // Import bot lazily to avoid circular dependency if any, 
      // but here we can just use the exported bot from bot.ts or send via telegram directly if we have the token.
      // Since we are in api.ts, we might not want to import bot.ts.
      // But we can use the bot token from env if available.
    }
    return Promise.reject(error);
  }
);

export async function updateLocation(data: UpdateLocationDto): Promise<void> {
  await api.post('specialists/location', data);
}

export async function getSpecialistStatus(telegramId: string | number): Promise<{ isBanned: boolean; isOnShift: boolean } | null> {
  const res = await api.get('specialists/status', { params: { telegramId } });
  return res.data;
}

export async function registerSpecialist(data: RegisterSpecialistDto): Promise<any> {
  const res = await api.post('specialists/register', data);
  return res.data;
}

export async function getOrdersNearby(
  telegramId: string | number,
  radius?: number
): Promise<Order[]> {
  const response = await api.get<Order[]>('specialists/orders/nearby', {
    params: { telegramId, radius },
  });
  return response.data;
}

export async function getAllOrders(telegramId: string | number): Promise<Order[]> {
  const response = await api.get<Order[]>('specialists/orders/nearby', {
    params: { telegramId, radius: 1000 }, // Large radius to get all
  });
  return response.data;
}

export async function specialistOffline(telegramId: string | number): Promise<void> {
  await api.post('specialists/offline', { telegramId });
}

export async function getActiveOrder(
  telegramId: string | number
): Promise<Order | null> {
  const response = await api.get<Order>('specialists/active-order', {
    params: { telegramId },
  });
  return response.data || null;
}

export async function completeOrder(
  orderId: number,
  telegramId: string | number
): Promise<Order> {
  const response = await api.post<Order>(`order/${orderId}/complete-bot`, {
    telegramId,
  });
  return response.data;
}


