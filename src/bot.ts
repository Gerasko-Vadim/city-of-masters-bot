// src/bot.ts

import { Telegraf, Markup } from "telegraf";
import { registerSpecialist, specialistOffline, updateLocation } from "./api";

export const bot = new Telegraf(process.env.BOT_TOKEN!);

// /start
bot.start(async (ctx) => {
  if (!ctx.from) return;

  await registerSpecialist({
    telegramId: ctx.from.id,
    name: ctx.from.first_name,
  });

  await ctx.reply(
    "Привет! Я бот City of Masters 👋\n\nНажми «Я на смене», чтобы получать заказы рядом с тобой.",
    Markup.keyboard([["🟢 Я на смене"], ["⛔ Я не на смене"]]).resize()
  );
});

bot.hears("🟢 Я на смене", async (ctx) => {
  if (!ctx.from) return;

//   await specialistOnline(ctx.from.id);

  await ctx.reply(
    "Отправь свою геолокацию 📍",
    Markup.keyboard([
      [{ text: "📍 Отправить локацию", request_location: true }],
    ])
      .resize()
      .oneTime()
  );
});

bot.hears("⛔ Я не на смене", async (ctx) => {
  if (!ctx.from) return;

  await specialistOffline(ctx.from.id);
  await ctx.reply("⛔ Ты снят со смены. Заказы приходить не будут.");
});

bot.on("location", async (ctx) => {
  if (!ctx.from) return;

  try {
    const { latitude, longitude } = ctx.message.location;

    await updateLocation({
      telegramId: ctx.from.id,
      lat: latitude,
      lng: longitude,
    });

    await ctx.reply("✅ Локация получена. Ищу заказы рядом 📡");
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Ошибка при сохранении локации. Попробуй ещё раз.");
  }
});


