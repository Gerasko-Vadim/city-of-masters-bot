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

// Configure commands and menu button
bot.telegram.setMyCommands([
  { command: "start", description: "Запустить бота 🚀" },
  { command: "stop", description: "Завершить смену ⛔" },
]);

bot.telegram.setChatMenuButton({ menuButton: { type: "commands" } });

// /start
bot.start(async (ctx) => {
  if (!ctx.from) return;

  await registerSpecialist({
    telegramId: ctx.from.id,
    name: ctx.from.first_name,
    username: ctx.from.username,
  });

  const welcomeMessage = `
<b>Что умеет этот бот?</b>
Бот находит заявки от потенциальных клиентов в режиме реального времени.

Выбери сферу, город — и получай релевантные заявки клиентов из всех чатов в личку.
Не нужно мониторить чаты, думать про ключевые слова и пробираться сквозь инфо-шум. Мы все это сделаем за тебя.

Даже если клиент опечатался или неясно выразился, мы все равно его поймаем 👌

🤖 <b>Bonus:</b> благодаря нейронке мы фильтруем не релевантные запросы с точностью до 98%.

👇 <i>Чтобы использовать бота, нажмите кнопку ниже:</i>`;

  await ctx.replyWithHTML(
    welcomeMessage,
    Markup.keyboard([["🟢 Я на смене"]]).resize().oneTime()
  );
});

bot.hears(["🟢 Я на смене"], async (ctx) => {
  if (!ctx.from) return;

  await ctx.reply(
    "Чтобы найти заказы рядом, мне нужно знать, где вы находитесь. Пожалуйста, отправьте свою локацию 📍",
    Markup.keyboard([
      [{ text: "📍 Отправить локацию", request_location: true }],
    ])
      .resize()
      .oneTime()
  );
});

bot.hears(["⛔ Выйти со смены", "⛔ Я не на смене", "/stop"], async (ctx) => {
  if (!ctx.from) return;

  await specialistOffline(ctx.from.id);
  await ctx.reply(
    "⛔ Ты снят со смены. Заказы приходить не будут.",
    Markup.keyboard([["🟢 Я на смене"]]).resize()
  );
});

async function sendNearbyOrders(ctx: any, telegramId: number) {
  try {
    const orders = await getOrdersNearby(telegramId);

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
        `📦 <b>Новый заказ рядом!</b>\n\n📍 ${order.address}\n💰 ${
          order.totalAmount
        } сом\n📝 ${order.description || "Без описания"}\n📞 ${maskedPhone}`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            Markup.button.callback("✅ Принять заказ", `accept_${order.id}`),
          ]),
        }
      );
    }
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Ошибка при поиске заказов.");
  }
}

bot.on("text", async (ctx) => {
  if (!ctx.from || !ctx.message.text || ctx.message.text.startsWith("/")) return;

  try {
    // If it's one of the keyboard buttons, skip (handled by bot.hears)
    if (["🟢 Я на смене", "⛔ Я не на смене"].includes(ctx.message.text)) return;

    await api.post("/chat/specialist-send", {
      telegramId: ctx.from.id,
      text: ctx.message.text,
    });
  } catch (e) {
    // Silent fail if no active order
  }
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

    // Persistent menu for shift management
    await ctx.reply(
      "🔍 Ищу заказы рядом...",
      Markup.keyboard([
        [{ text: "🔄 Обновить заказы", request_location: true }],
        ["⛔ Выйти со смены"]
      ]).resize()
    );
    await sendNearbyOrders(ctx, ctx.from.id);
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
          `✅ <b>Вы приняли заказ!</b>\n\n📍 ${order.address}\n💰 ${
            order.totalAmount
          } сом\n📝 ${order.description || "Без описания"}\n📞 ${order.phone}\n👤 ${
            order.customerName
          }\n\n🗺 <b>Открыть карту:</b>`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.url("Google Maps", googleLink)],
              [Markup.button.url("2GIS", dgisLink)],
              [Markup.button.callback("✅ Завершить заказ", `complete_${order.id}`)],
            ]),
          }
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
          "🎉 Заказ успешно завершен! Ищу новые заказы рядом...",
          Markup.keyboard(["🟢 Я на смене", "⛔ Я не на смене"]).resize()
        );
        await sendNearbyOrders(ctx, ctx.from.id);
      } catch (error: any) {
         console.error(
          "Failed to complete order:",
          error.response?.data || error.message
        );
        await ctx.answerCbQuery("❌ Ошибка");
        await ctx.reply("❌ Не удалось завершить заказ.");
      }
    } else if (data && data.startsWith("skip_")) {
      await ctx.answerCbQuery("❌ Пропущено");
      await ctx.deleteMessage().catch(() => {});
    }
  }
});

