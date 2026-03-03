// src/types.ts
export interface Order {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  totalAmount: number;
  status: 'NEW' | 'PAID' | 'IN_PROGRESS' | 'COMPLETED';
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
  assignedSpecialistId?: number;
  description?: string;
  category?: string;
  distance?: number;
}

export interface Specialist {
  id: number;
  telegramId: number;
  name: string;
  isOnShift: boolean;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface RegisterSpecialistDto {
  telegramId: number;
  name: string;
  username?: string;
}

export interface UpdateLocationDto {
  telegramId: number;
  lat: number;
  lng: number;
}

export interface AssignOrderDto {
  telegramId: number;
}
