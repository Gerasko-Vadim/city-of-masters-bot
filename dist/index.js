"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
require("dotenv/config");
const bot_1 = require("./bot");
bot_1.bot.launch();
console.log('🤖 Telegram bot started');
process.once('SIGINT', () => bot_1.bot.stop('SIGINT'));
process.once('SIGTERM', () => bot_1.bot.stop('SIGTERM'));
