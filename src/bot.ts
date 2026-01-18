// src/bot.ts

import { Telegraf, Markup } from "telegraf";
import {
  api,
  registerSpecialist,
  specialistOffline,
  updateLocation,
} from "./api";

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

    const res = await api.get("/order/nearby", {
      params: { telegramId: ctx.from.id },
    });

    const orders = res.data;

    if (!orders.length) {
      await ctx.reply("📭 Пока нет заказов рядом.");
      return;
    }

    for (const order of orders) {
      await ctx.reply(
        `📦 Новый заказ рядом!\n\n👤 ${order.customerName}\n📞 ${order.phone}\n📍 ${order.address}\n💰 ${order.totalAmount}`,
        Markup.inlineKeyboard([
          Markup.button.callback("✅ Принять заказ", `accept_${order.id}`),
        ])
      );
    }
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Ошибка при обработке локации.");
  }
});

bot.on("callback_query", async (ctx) => {
  if ("data" in ctx.callbackQuery) {
    const data = ctx.callbackQuery.data;

    if (data && data.startsWith("accept_")) {
      const orderId = Number(data.replace("accept_", ""));

      await api.post(`/order/${orderId}/assign`, {
        telegramId: ctx.from.id,
      });

      await ctx.answerCbQuery("✅ Заказ принят!");
      await ctx.reply("📦 Контакты клиента отправлены.");
    }
  }
});
