// src/bot.ts

import { Telegraf, Markup } from "telegraf";
import {
  api,
  getOrdersNearby,
  getAllOrders,
  registerSpecialist,
  specialistOffline,
  updateLocation,
} from "./api";
import type { Order } from "./types";

export const bot = new Telegraf(process.env.BOT_TOKEN!);
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
Привет! Это — <b>Город Мастеров</b>, крупнейшая база заказов для профи своего дела. 🚀

<b>Почему мастера выбирают нас:</b>
✅ <b>Прямые заказы:</b> Клиенты обращаются к нам напрямую, а вы получаете готовые заявки.
✅ <b>Всегда рядом:</b> Наша нейросеть понимает, где вы находитесь, и предлагает только ближайшие заказы.
✅ <b>Огромная база:</b> Тысячи актуальных заказов в самых разных категориях каждый день.
✅ <b>Никакого шума:</b> Мы фильтруем запросы, чтобы вы видели только то, что вам по душе.
✅ <b>Мгновенный старт:</b> Выходите на смену и начинайте получать уведомления о заказах в ту же секунду.

👇 <b>Готовы найти свой следующий заказ? Жмите кнопку ниже:</b>`;

  await ctx.replyWithHTML(
    welcomeMessage,
    Markup.keyboard([["🟢 Я на смене"]]).resize().oneTime()
  );
});

bot.hears(["🟢 Я на смене"], async (ctx) => {
  if (!ctx.from) return;

  const message = `
📍 <b>Чтобы найти заказы рядом, нужно отправить локацию</b>

Для стабильной работы мы рекомендуем включить <b>автоматическое обновление</b>:
1️⃣ Нажмите на иконку скрепки 📎 (или ➕)
2️⃣ Выберите <b>«Геопозиция»</b> 📍
3️⃣ Нажмите <b>«Транслировать мою геопозицию»</b>
4️⃣ Выберите <b>«8 часов»</b>

<i>Так вы будете получать новые заказы автоматически, даже если телефон в кармане!</i> 👇
  `;

  await ctx.replyWithHTML(
    message,
    Markup.keyboard([
      [{ text: "📍 Отправить локацию (один раз)", request_location: true }],
    ]).resize().oneTime()
  );
});

bot.action("go_on_shift", async (ctx) => {
  if (!ctx.from) return;
  await ctx.answerCbQuery();
  
  const message = `
📍 <b>Чтобы найти заказы рядом, нужно отправить локацию</b>

Для стабильной работы мы рекомендуем включить <b>автоматическое обновление</b>:
1️⃣ Нажмите на иконку скрепки 📎 (или ➕)
2️⃣ Выберите <b>«Геопозиция»</b> 📍
3️⃣ Нажмите <b>«Транслировать мою геопозицию»</b>
4️⃣ Выберите <b>«8 часов»</b>

<i>Так вы будете получать новые заказы автоматически, даже если телефон в кармане!</i> 👇
  `;

  await ctx.replyWithHTML(
    message,
    Markup.keyboard([
      [{ text: "📍 Отправить локацию (один раз)", request_location: true }],
    ]).resize().oneTime()
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

async function sendNearbyOrders(ctx: any, telegramId: number, radius = 5, isAll = false) {
  try {
    const orders = isAll ? await getAllOrders(telegramId) : await getOrdersNearby(telegramId, radius);

    if (!orders.length) {
      if (!isAll && radius < 10) {
        await ctx.reply(
          "📭 В радиусе 5 км заказов не найдено. Хотите расширить поиск?",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔍 Искать в радиусе 10 км", "radius_10")],
            [Markup.button.callback("🌐 Показать все заказы", "view_all")],
          ])
        );
      } else {
        await ctx.reply("📭 Пока нет доступных заказов.");
      }
      return;
    }

    const title = isAll ? "🌐 Все доступные заказы" : `📦 Заказы в радиусе ${radius} км`;
    await ctx.reply(`<b>${title}:</b>`, { parse_mode: "HTML" });

    for (const order of orders) {
      const distanceMsg = order.distance !== undefined ? `\n🏃‍♂️ Расстояние: ${order.distance.toFixed(1)} км` : "";
      const maskedPhone =
        order.phone.length > 3
          ? order.phone.slice(0, -3) + "***"
          : order.phone + "***";

      // If distance > 15km and we are in "view all" mode, don't show accept button
      const canAccept = !isAll || (order.distance !== undefined && order.distance <= 15);

      const buttons = [];
      if (canAccept) {
        buttons.push([Markup.button.callback("✅ Принять заказ", `accept_${order.id}`)]);
      } else {
        buttons.push([Markup.button.callback("📍 Слишком далеко", "noop")]);
      }

      await ctx.reply(
        `📍 ${order.address}${distanceMsg}\n💰 ${
          order.totalAmount
        } сом\n📝 ${order.description || "Без описания"}\n📞 ${maskedPhone}`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    }

    if (!isAll && radius === 5 && orders.length > 0) {
      await ctx.reply(
        "Хотите увидеть больше?",
        Markup.inlineKeyboard([
          [Markup.button.callback("🌐 Показать все заказы", "view_all")],
        ])
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
    if (["🟢 Я на смене", "⛔ Я не на смене", "⛔ Выйти со смены"].includes(ctx.message.text)) return;

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

    // Persistent menu for shift management (only sent if not already showing the search message recently)
    // For live location updates, we don't want to spam messages.
    // We only reply if it's NOT a background update or if it's the first one.
    // ctx.message.location has 'live_period' if it's a live location.
    const isLiveUpdate = !!(ctx.message as any).location.live_period;
    
    if (!isLiveUpdate) {
      await ctx.reply(
        "🔍 Ищу заказы рядом...",
        Markup.keyboard([
          [{ text: "🔄 Обновить заказы", request_location: true }],
          ["⛔ Выйти со смены"]
        ]).resize()
      );
      await sendNearbyOrders(ctx, ctx.from.id);
    }
  } catch (e) {
    console.error(e);
    // Silent fail for background location updates to avoid annoying the user
    // but notify for manual ones.
    if (!(ctx.message as any).location.live_period) {
       await ctx.reply("❌ Ошибка при обработке локации.");
    }
  }
});

bot.action("radius_10", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(undefined);
  await sendNearbyOrders(ctx, ctx.from!.id, 10);
});

bot.action("view_all", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(undefined);
  await sendNearbyOrders(ctx, ctx.from!.id, 1000, true);
});

bot.action("noop", async (ctx) => {
  await ctx.answerCbQuery("📍 Этот заказ находится слишком далеко", { show_alert: true });
});

bot.action("find_orders", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(undefined);
  await sendNearbyOrders(ctx, ctx.from!.id);
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
          telegramId: ctx.from!.id,
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
        const statusCode = error.response?.status;
        const isTaken = statusCode === 409;

        await ctx.answerCbQuery(
          isTaken ? "😔 Кто-то успел раньше" : "❌ Ошибка",
          { show_alert: true }
        );

        if (isTaken) {
          await ctx.reply(
            "😔 <b>Заказ уже занят</b>\n\nКто-то из мастеров успел принять его раньше вас. Попробуйте взять другой заказ!",
            {
              parse_mode: "HTML",
              ...Markup.inlineKeyboard([
                [Markup.button.callback("🔍 Найти другие заказы", "find_orders")],
              ]),
            }
          );
        } else {
          await ctx.reply("❌ Не удалось принять заказ. Попробуйте чуть позже.");
        }
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

