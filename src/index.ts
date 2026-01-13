// src/index.ts
import 'dotenv/config';
import { bot } from './bot';

bot.launch();

console.log('🤖 Telegram bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
