// src/bot.ts

import { Telegraf, Markup } from "telegraf";
import {
  api,
  getOrdersNearby,
  registerSpecialist,
  specialistOffline,
  updateLocation,
} from "./api";
import type { Order } from "./types";

export const bot = new Telegraf(process.env.BOT_TOKEN!);

// /start
bot.start(async (ctx) => {
  if (!ctx.from) return;

  await registerSpecialist({
    telegramId: ctx.from.id,
    name: ctx.from.first_name,
    username: ctx.from.username,
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

    // Check for active order first
    const activeOrderLine = await api
      .get<Order>("specialists/active-order", {
        params: { telegramId: ctx.from.id },
      })
      .then((res) => res.data)
      .catch(() => null);

    if (activeOrderLine) {
      await ctx.reply(
        `🚧 У вас уже есть активный заказ!\n\n📍 ${activeOrderLine.address}\nЗавершите его, прежде чем брать новые.`,
        Markup.inlineKeyboard([
          Markup.button.callback(
            "✅ Завершить заказ",
            `complete_${activeOrderLine.id}`
          ),
        ])
      );
      return;
    }

    // Remove the location request keyboard
    await ctx.reply("🔍 Ищу заказы рядом...", Markup.removeKeyboard());

    const orders = await getOrdersNearby(ctx.from.id);

    if (!orders.length) {
      await ctx.reply("📭 Пока нет заказов рядом.");
      return;
    }

    for (const order of orders) {
      const maskedPhone =
        order.phone.length > 3
          ? order.phone.slice(0, -3) + "***"
          : order.phone + "***";

      await ctx.reply(
        `📦 Новый заказ рядом!\n\n📍 ${order.address}\n💰 Сумма: ${
          order.totalAmount
        }₽\n📝 ${order.description || "Без описания"}\n📞 ${maskedPhone}`,
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
        const res = await api.post<{
          id: number;
          address: string;
          totalAmount: number;
          description: string;
          phone: string;
          customerName: string;
          lat: number;
          lng: number;
        }>(`/order/${orderId}/assign-bot`, {
          telegramId: ctx.from.id,
        });
        const order = res.data;

        await ctx.answerCbQuery("✅ Заказ принят!");

        const dgisLink = `https://2gis.ru/geo/${order.lng},${order.lat}`;
        const googleLink = `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`;

        await ctx.reply(
          `✅ Вы приняли заказ!\n\n📍 ${order.address}\n💰 ${
            order.totalAmount
          }₽\n📝 ${order.description || "Без описания"}\n📞 ${order.phone}\n👤 ${
            order.customerName
          }\n\n🗺 Открыть карту:`,
          Markup.inlineKeyboard([
            [Markup.button.url("Google Maps", googleLink)],
            [Markup.button.url("2GIS", dgisLink)],
            [Markup.button.callback("✅ Завершить заказ", `complete_${order.id}`)],
          ])
        );
      } catch (error: any) {
        console.error(
          "Failed to assign order:",
          error.response?.data || error.message
        );
        const errorMessage =
          error.response?.data?.message || "Не удалось принять заказ";
        await ctx.answerCbQuery("❌ Ошибка");
        await ctx.reply(`❌ ${errorMessage}`);
      }
    } else if (data && data.startsWith("complete_")) {
      const orderId = Number(data.replace("complete_", ""));
      try {
        await api.post(`/order/${orderId}/complete-bot`, {
          telegramId: ctx.from.id,
        });
        await ctx.answerCbQuery("✅ Заказ завершен!");
        await ctx.reply(
          "🎉 Заказ успешно завершен! Вы можете искать новые заказы.",
          Markup.keyboard([["🟢 Я на смене"], ["⛔ Я не на смене"]]) // Restore main menu
        );
      } catch (error: any) {
         console.error(
          "Failed to complete order:",
          error.response?.data || error.message
        );
        await ctx.answerCbQuery("❌ Ошибка");
        await ctx.reply("❌ Не удалось завершить заказ.");
      }
    }
  }
});

