"use strict";
// src/bot.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const api_1 = require("./api");
exports.bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
// /start
exports.bot.start(async (ctx) => {
    if (!ctx.from)
        return;
    await (0, api_1.registerSpecialist)({
        telegramId: ctx.from.id,
        name: ctx.from.first_name,
    });
    await ctx.reply("Привет! Я бот City of Masters 👋\n\nНажми «Я на смене», чтобы получать заказы рядом с тобой.", telegraf_1.Markup.keyboard([["🟢 Я на смене"], ["⛔ Я не на смене"]]).resize());
});
exports.bot.hears("🟢 Я на смене", async (ctx) => {
    if (!ctx.from)
        return;
    //   await specialistOnline(ctx.from.id);
    await ctx.reply("Отправь свою геолокацию 📍", telegraf_1.Markup.keyboard([
        [{ text: "📍 Отправить локацию", request_location: true }],
    ])
        .resize()
        .oneTime());
});
exports.bot.hears("⛔ Я не на смене", async (ctx) => {
    if (!ctx.from)
        return;
    await (0, api_1.specialistOffline)(ctx.from.id);
    await ctx.reply("⛔ Ты снят со смены. Заказы приходить не будут.");
});
exports.bot.on("location", async (ctx) => {
    if (!ctx.from)
        return;
    try {
        const { latitude, longitude } = ctx.message.location;
        await (0, api_1.updateLocation)({
            telegramId: ctx.from.id,
            lat: latitude,
            lng: longitude,
        });
        await ctx.reply("✅ Локация получена. Ищу заказы рядом 📡");
    }
    catch (e) {
        console.error(e);
        await ctx.reply("❌ Ошибка при сохранении локации. Попробуй ещё раз.");
    }
});
