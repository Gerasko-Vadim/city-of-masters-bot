"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLocation = updateLocation;
exports.registerSpecialist = registerSpecialist;
exports.specialistOffline = specialistOffline;
// src/api.ts
const axios_1 = __importDefault(require("axios"));
const api = axios_1.default.create({
    baseURL: process.env.API_URL,
});
async function updateLocation(data) {
    await api.post('specialists/location', data);
}
async function registerSpecialist(data) {
    await api.post('specialists/register', data);
}
async function specialistOffline(telegramId) {
    await api.post('specialists/offline', { telegramId });
}
