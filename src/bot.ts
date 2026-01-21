// src/bot.ts

import { Telegraf, Markup } from "telegraf";
import {
  api,
  getOrdersNearby,
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

    const orders = await getOrdersNearby(ctx.from.id);

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

      try {
        // Use new bot-specific endpoint (no JWT required)
        await api.post(`/order/${orderId}/assign-bot`, {
          telegramId: ctx.from.id,
        });

        await ctx.answerCbQuery("✅ Заказ принят!");
        await ctx.reply("📦 Заказ закреплён за вами. Контакты клиента отправлены.");
      } catch (error: any) {
        console.error('Failed to assign order:', error.response?.data || error.message);
        
        const errorMessage = error.response?.data?.message || 
                            error.response?.status === 409 
                              ? "Заказ уже взял другой специалист" 
                              : "Произошла ошибка";
        
        await ctx.answerCbQuery("❌ Не удалось принять заказ");
        await ctx.reply(`❌ ${errorMessage}`);
      }
    }
  }
});

