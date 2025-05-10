import { Bot } from "grammy";
import dotenv from "dotenv";
import { logger } from "./types";
import { session } from "grammy";
import { handlers, MyContext, ToolSession } from "./handlers/telegram";

// Load environment variables
dotenv.config();

// Debug logs
console.log('Environment variables:', {
  BOT_TOKEN: process.env.BOT_TOKEN ? 'exists' : 'missing',
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? 'exists' : 'missing',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? 'exists' : 'missing'
});

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN must be provided!");
}

// Initialize bot with session
const bot = new Bot<MyContext>(process.env.BOT_TOKEN);
bot.use(session({ initial: (): ToolSession => ({}) }));

// Set bot commands
bot.api.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "savetool", description: "Save a new AI tool to the database" }
]);

// Register command handlers
bot.command("start", handlers.start);
bot.command("savetool", handlers.saveTool);

// Register callback handler
bot.on("callback_query:data", handlers.handleCallback);

// Register error handler
bot.catch(handlers.handleError);

const main = async () => {
  await bot.start();
  logger.info("Bot started!");
};

main().catch(err => {
  logger.error("Bot failed to start:", err);
  process.exit(1);
});