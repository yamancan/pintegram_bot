import { Context, SessionFlavor } from "grammy";
import { InlineKeyboard } from "grammy";
import { logger, parseSaveToolCommand, CommandParseError } from "../types";
import { airtableService } from "../services/airtable";

// Session interface
export interface ToolSession {
  initialTool?: {
    name: string;
    url: string;
    description: string;
  };
  types?: string[];
  state?: string;
  apiServices?: string;
  isPaid?: string[];
  userId?: number;
  startTime?: number;  // Add timestamp for session start
  lastMessageId?: number;  // Store last message ID for cleanup
  summaryTimeoutId?: NodeJS.Timeout;
  summaryMessageId?: number;
  lastRecordId?: string; // Added for storing record ID
}

export type MyContext = Context & SessionFlavor<ToolSession>;

// Constants
const SESSION_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds
const CLEANUP_MESSAGE_TIMEOUT = 15 * 1000; // 15 seconds in milliseconds

// Helper function to check session timeout
const isSessionExpired = (session: ToolSession): boolean => {
  if (!session.startTime) return false;
  return Date.now() - session.startTime > SESSION_TIMEOUT;
};

// Helper function to cleanup expired session
const handleExpiredSession = async (ctx: MyContext) => {
  const timeoutMessage = await ctx.reply("⏰ Session expired due to inactivity. Please start over with /savetool");
  ctx.session = {};
  
  // Delete the timeout message after 15 seconds
  setTimeout(async () => {
    try {
      if (ctx.chat?.id) {
        await ctx.api.deleteMessage(ctx.chat.id, timeoutMessage.message_id);
      }
    } catch (error) {
      logger.error('Failed to delete timeout message:', error);
    }
  }, CLEANUP_MESSAGE_TIMEOUT);
};

// Helper function to create types keyboard
const createTypesKeyboard = (selectedTypes: string[] = []): InlineKeyboard => {
  const keyboard = new InlineKeyboard();
  
  // Special type
  const isUndefinedSelected = selectedTypes.includes("Undefined");
  keyboard.text(`Undefined ${isUndefinedSelected ? '✅' : ''}`, "type_undefined").row();

  // Text based transformations
  keyboard
    .text(`Text to Image ${selectedTypes.includes("Text to Image") ? '✅' : ''}`, "type_text_to_image")
    .text(`Text to Video ${selectedTypes.includes("Text to Video") ? '✅' : ''}`, "type_text_to_video")
    .row();

  // Image based transformations
  keyboard
    .text(`Image to Image ${selectedTypes.includes("Image to Image") ? '✅' : ''}`, "type_image_to_image")
    .text(`Image to Video ${selectedTypes.includes("Image to Video") ? '✅' : ''}`, "type_image_to_video")
    .row();

  // Character based transformations
  keyboard
    .text(`Character to Image ${selectedTypes.includes("Character to Image") ? '✅' : ''}`, "type_character_to_image")
    .text(`Character to Video ${selectedTypes.includes("Character to Video") ? '✅' : ''}`, "type_character_to_video")
    .row();

  // Audio related
  keyboard
    .text(`Text to Sound ${selectedTypes.includes("Text to Sound") ? '✅' : ''}`, "type_text_to_sound")
    .text(`Text to Speech ${selectedTypes.includes("Text to Speech") ? '✅' : ''}`, "type_text_to_speech")
    .row()
    .text(`Text to Music ${selectedTypes.includes("Text to Music") ? '✅' : ''}`, "type_text_to_music")
    .row();

  // Helpers and others
  keyboard
    .text(`Image Helper ${selectedTypes.includes("Image Helper") ? '✅' : ''}`, "type_image_helper")
    .text(`Video Helper ${selectedTypes.includes("Video Helper") ? '✅' : ''}`, "type_video_helper")
    .row()
    .text(`AI Aggregator ${selectedTypes.includes("AI Aggregator") ? '✅' : ''}`, "type_ai_aggregator")
    .text(`Automation ${selectedTypes.includes("Automation") ? '✅' : ''}`, "type_automation")
    .row();

  // Navigation
  keyboard.text("❌ Cancel", "abort").text("Next ➡️", "types_done");
  return keyboard;
};

// Helper function to create payment keyboard
const createPaymentKeyboard = (selectedPayments: string[] = []): InlineKeyboard => {
  const paymentButtons = [
    ["Pay as you Go", "paid_pay_go"],
    ["Monthly", "paid_monthly"],
    ["Freemium", "paid_freemium"],
    ["Open Source", "paid_opensource"]
  ];

  const keyboard = new InlineKeyboard();
  
  paymentButtons.forEach(([label, callback]) => {
    const isSelected = selectedPayments.includes(label);
    keyboard.text(`${label} ${isSelected ? '✅' : ''}`, callback).row();
  });

  keyboard.text("❌ Cancel", "abort").text("⬅️ Back", "nav_api").text("Save ✅", "paid_done");
  return keyboard;
};

// Helper function to create API services keyboard
const createServicesKeyboard = (selectedService?: string): InlineKeyboard => {
  const serviceButtons = [
    ["Fully", "api_fully"],
    ["Partially", "api_partially"],
    ["Unofficial", "api_unofficial"],
    ["Not Provided", "api_not_provided"]
  ];

  const keyboard = new InlineKeyboard();
  
  serviceButtons.forEach(([label, callback]) => {
    const isSelected = selectedService === label;
    keyboard.text(`${label} ${isSelected ? '✅' : ''}`, callback).row();
  });

  keyboard.text("❌ Cancel", "abort").text("⬅️ Back", "nav_types").text("Next ➡️", "api_done");
  return keyboard;
};

// Helper function to create abort confirmation keyboard
const createAbortConfirmationKeyboard = (returnCallback: string): InlineKeyboard => {
  return new InlineKeyboard()
    .text("Yes, cancel everything", "abort_confirm")
    .text("No, go back", returnCallback);
};

// Helper function to create confirmation keyboard
const createConfirmationKeyboard = (): InlineKeyboard => {
  return new InlineKeyboard()
    .text("Yes, add more details ➡️", "confirm_yes")
    .text("No, save as is ✅", "confirm_no");
};

// Helper function to create summary keyboard
const createSummaryKeyboard = (): InlineKeyboard => {
  return new InlineKeyboard()
    .text("❌ Cancel", "summary_cancel")
    .text("✏️ Edit", "summary_edit")
    .text("✅ Approve", "summary_approve");
};

// Helper function to create final summary keyboard
const createFinalSummaryKeyboard = (): InlineKeyboard => {
  return new InlineKeyboard()
    .text("🗑️ Delete", "delete_summary");
};

// Helper function to handle summary message cleanup
const handleSummaryMessage = async (ctx: MyContext, summaryMessage: { message_id: number }, completeTool: any) => {
  let isHandled = false;

  // Set timeout for auto-approve
  const timeoutId = setTimeout(async () => {
    if (!isHandled) {
      isHandled = true;
      try {
        if (ctx.chat?.id) {
          // Edit message to show auto-approved status
          await ctx.api.editMessageText(
            ctx.chat.id,
            summaryMessage.message_id,
            `Tool auto-approved and saved! ✅\n\n<b>Summary:</b>\n` +
            `<b>Name:</b> ${completeTool.name}\n` +
            `<b>URL:</b> ${completeTool.url}\n` +
            `<b>Description:</b> ${completeTool.description}\n` +
            `<b>Types:</b> ${completeTool.types.join(", ")}\n` +
            `<b>API Services:</b> ${completeTool.apiServices}\n` +
            `<b>Payment:</b> ${completeTool.isPaid.join(", ")}`,
            { parse_mode: "HTML" }
          );

          // Delete the message after a short delay
          setTimeout(async () => {
            try {
              if (ctx.chat?.id && summaryMessage.message_id) {
                await ctx.api.deleteMessage(ctx.chat.id, summaryMessage.message_id);
              }
            } catch (error) {
              logger.error('Failed to delete auto-approved message:', error);
            }
          }, 5000); // Delete after 5 seconds
        }
      } catch (error) {
        logger.error('Failed to handle auto-approve:', error);
      }
    }
  }, CLEANUP_MESSAGE_TIMEOUT);

  return { timeoutId, setHandled: () => { isHandled = true; } };
};

export const handlers = {
  // Start command handler
  start: async (ctx: MyContext) => {
    await ctx.reply("Bot is running! Use /savetool to save a new tool.");
  },

  // Save tool command handler
  saveTool: async (ctx: MyContext) => {
    try {
      const initialTool = parseSaveToolCommand(ctx.message?.text || "");
      ctx.session.initialTool = initialTool;
      ctx.session.userId = ctx.from?.id;
      ctx.session.startTime = Date.now();
      
      const message = await ctx.reply(
        "Tool info received! 📝\n\n" +
        `<b>Name:</b> ${initialTool.name}\n` +
        `<b>URL:</b> ${initialTool.url}\n` +
        `<b>Description:</b> ${initialTool.description}\n\n` +
        "Would you like to add more details (types, API info, payment options)?", 
        { 
          parse_mode: "HTML",
          reply_markup: createConfirmationKeyboard() 
        }
      );
      
      ctx.session.lastMessageId = message.message_id;
    } catch (error) {
      if (error instanceof CommandParseError) {
        logger.error(`Command parse error: ${error.message}`);
        await ctx.reply(error.message);
      } else {
        logger.error("Error saving tool:", error);
        await ctx.reply("Sorry, there was an error saving your tool 😔");
      }
    }
  },

  // Button click handler
  handleCallback: async (ctx: MyContext) => {
    try {
      // Try to answer callback query but ignore timeout errors
      try {
        await ctx.answerCallbackQuery();
      } catch (error: any) {
        // Ignore "query is too old" and "query ID is invalid" errors
        if (!error.description?.includes('query is too old') && 
            !error.description?.includes('query ID is invalid')) {
          throw error;
        }
      }
      
      const data = ctx.callbackQuery?.data;
      if (!data) {
        logger.error('No callback data received');
        return;
      }

      // Check if session is expired
      if (isSessionExpired(ctx.session)) {
        await handleExpiredSession(ctx);
        return;
      }

      // Check if the user who clicked is the same who started
      if (ctx.from?.id !== ctx.session.userId) {
        await ctx.answerCallbackQuery({
          text: "⚠️ Only the person who started can interact with these buttons",
          show_alert: true
        });
        return;
      }
      
      logger.info(`Button clicked: ${data}`);

      // Helper function to safely update keyboard
      const safeUpdateKeyboard = async (keyboard: InlineKeyboard) => {
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
        } catch (error: any) {
          // Ignore "message not modified" error
          if (error.description?.includes('message is not modified')) {
            return;
          }
          // Handle rate limit error
          if (error.description?.includes('Too Many Requests')) {
            const retryAfter = error.parameters?.retry_after || 2;
            await ctx.reply(`⚠️ Please wait ${retryAfter} seconds before clicking buttons again.`);
            return;
          }
          // Log other errors
          logger.error('Error updating keyboard:', error);
        }
      };

      if (data.startsWith('confirm_')) {
        if (data === 'confirm_yes') {
          // Delete the initial message
          if (ctx.chat?.id && ctx.session.lastMessageId) {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, ctx.session.lastMessageId);
            } catch (error) {
              logger.error('Failed to delete initial message:', error);
            }
          }
          
          const message = await ctx.reply("Select types (multiple possible):", { 
            reply_markup: createTypesKeyboard() 
          });
          ctx.session.lastMessageId = message.message_id;
        } else if (data === 'confirm_no' && ctx.session.initialTool) {
          // Delete the initial message
          if (ctx.chat?.id && ctx.session.lastMessageId) {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, ctx.session.lastMessageId);
            } catch (error) {
              logger.error('Failed to delete initial message:', error);
            }
          }

          // Save with default values - all optional fields should be Undefined
          const completeTool = {
            name: ctx.session.initialTool.name,
            url: ctx.session.initialTool.url,
            description: ctx.session.initialTool.description,
            types: ["Undefined"],
            state: "Undefined",
            apiServices: "Undefined",
            isPaid: ["Undefined"]
          };

          const record = await airtableService.saveTool(completeTool);
          ctx.session.lastRecordId = record.id; // Store the record ID for potential edits
          const summaryMessage = await ctx.reply(
            "Tool saved successfully with minimal info! ✅\n\n<b>Summary:</b>\n" +
            `<b>Name:</b> ${completeTool.name}\n` +
            `<b>URL:</b> ${completeTool.url}\n` +
            `<b>Description:</b> ${completeTool.description}\n` +
            `<b>Types:</b> ${completeTool.types.join(", ")}\n` +
            `<b>API Services:</b> ${completeTool.apiServices}\n` +
            `<b>Payment:</b> ${completeTool.isPaid.join(", ")}`,
            {
              parse_mode: "HTML",
              reply_markup: createSummaryKeyboard()
            }
          );

          const { timeoutId, setHandled } = await handleSummaryMessage(ctx, summaryMessage, completeTool);
          ctx.session.summaryTimeoutId = timeoutId;
          ctx.session.summaryMessageId = summaryMessage.message_id;
          logger.info('Successfully saved to Airtable with minimal info');
        }
        return;
      }
      
      if (data.startsWith('nav_')) {
        const page = data.replace('nav_', '');
        if (page === 'types') {
          const message = await ctx.editMessageText("Select types (multiple possible):", { 
            reply_markup: createTypesKeyboard(ctx.session.types || [])
          }) as { message_id: number };
          ctx.session.lastMessageId = message.message_id;
        } else if (page === 'api') {
          const message = await ctx.editMessageText("Select API Service type:", { 
            reply_markup: createServicesKeyboard(ctx.session.apiServices)
          }) as { message_id: number };
          ctx.session.lastMessageId = message.message_id;
        }
        return;
      }
      
      if (data.startsWith('type_')) {
        ctx.session.types = ctx.session.types || [];
        const typeMap: { [key: string]: string } = {
          'text_to_video': 'Text to Video',
          'character_to_video': 'Character to Video',
          'image_to_image': 'Image to Image',
          'image_to_video': 'Image to Video',
          'text_to_image': 'Text to Image',
          'image_helper': 'Image Helper',
          'ai_aggregator': 'AI Aggregator',
          'video_helper': 'Video Helper',
          'character_to_image': 'Character to Image',
          'text_to_sound': 'Text to Sound',
          'text_to_speech': 'Text to Speech',
          'text_to_music': 'Text to Music',
          'automation': 'Automation',
          'undefined': 'Undefined'
        };
        
        const type = data.replace('type_', '');
        const formattedType = typeMap[type];
        
        if (formattedType) {
          const index = ctx.session.types.indexOf(formattedType);
          if (index === -1) {
            ctx.session.types.push(formattedType);
            logger.info(`Added type: ${formattedType}`);
          } else {
            ctx.session.types.splice(index, 1);
            logger.info(`Removed type: ${formattedType}`);
          }
          
          await ctx.editMessageText("Select types (multiple possible):", {
            reply_markup: createTypesKeyboard(ctx.session.types)
          });
        }
        return;
      }
      
      if (data === 'types_done') {
        const selectedTypes = ctx.session.types || [];
        if (selectedTypes.length === 0) {
          await ctx.reply("⚠️ Please select at least one type");
          return;
        }
        
        logger.info('Types selection completed');
        await ctx.editMessageText("Select API Service type:", { 
          reply_markup: createServicesKeyboard() 
        });
      }
      
      if (data.startsWith('api_')) {
        if (data === 'api_done') {
          if (!ctx.session.apiServices) {
            await ctx.reply("⚠️ Please select an API service type");
            return;
          }

          await ctx.editMessageText("Select payment options (multiple possible):", { 
            reply_markup: createPaymentKeyboard() 
          });
          return;
        }

        const apiMap: { [key: string]: string } = {
          'fully': 'Fully',
          'partially': 'Partially',
          'unofficial': 'Unofficial',
          'not_provided': 'Not Provided'
        };
        
        const apiKey = data.replace('api_', '');
        const apiService = apiMap[apiKey];
        
        if (apiService && ctx.session.apiServices !== apiService) {
          ctx.session.apiServices = apiService;
          logger.info(`Selected API service: ${apiService}`);
          await ctx.editMessageText("Select API Service type:", {
            reply_markup: createServicesKeyboard(apiService)
          });
        }
      }

      if (data.startsWith('paid_')) {
        if (data === 'paid_done') {
          if (!ctx.session.initialTool) {
            logger.error('No initial tool data found');
            return;
          }

          const selectedPayments = ctx.session.isPaid || [];
          if (selectedPayments.length === 0) {
            await ctx.reply("⚠️ Please select at least one payment option");
            return;
          }

          logger.info('Starting to save to Airtable with data:', {
            initialTool: ctx.session.initialTool,
            types: ctx.session.types,
            apiServices: ctx.session.apiServices,
            isPaid: ctx.session.isPaid
          });
          
          const completeTool = {
            name: ctx.session.initialTool.name,
            url: ctx.session.initialTool.url,
            description: ctx.session.initialTool.description,
            types: ctx.session.types?.length ? ctx.session.types : ["Undefined"],
            state: "Public",
            apiServices: ctx.session.apiServices || "Not Provided",
            isPaid: ctx.session.isPaid || ["Freemium"]
          };

          const record = await airtableService.saveTool(completeTool);
          ctx.session.lastRecordId = record.id; // Store the record ID for potential edits

          // Delete the last message if exists
          if (ctx.chat?.id && ctx.session.lastMessageId) {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, ctx.session.lastMessageId);
            } catch (error) {
              logger.error('Failed to delete last message:', error);
            }
          }

          const summaryMessage = await ctx.reply("Tool saved successfully! ✅\n\n<b>Summary:</b>\n" +
            `<b>Name:</b> ${completeTool.name}\n` +
            `<b>URL:</b> ${completeTool.url}\n` +
            `<b>Description:</b> ${completeTool.description}\n` +
            `<b>Types:</b> ${completeTool.types.join(", ")}\n` +
            `<b>API Services:</b> ${completeTool.apiServices}\n` +
            `<b>Payment:</b> ${completeTool.isPaid.join(", ")}`, {
            parse_mode: "HTML"
          });

          // Delete summary message after 15 seconds
          setTimeout(async () => {
            try {
              if (ctx.chat?.id) {
                await ctx.api.deleteMessage(ctx.chat.id, summaryMessage.message_id);
              }
            } catch (error) {
              logger.error('Failed to delete summary message:', error);
            }
          }, CLEANUP_MESSAGE_TIMEOUT);

          ctx.session = {};
          logger.info('Successfully saved to Airtable');
        } else {
          const paidMap: { [key: string]: string } = {
            'pay_go': 'Pay as you Go',
            'monthly': 'Monthly',
            'freemium': 'Freemium',
            'opensource': 'Open Source'
          };
          
          ctx.session.isPaid = ctx.session.isPaid || [];
          const paidKey = data.replace('paid_', '');
          const paidType = paidMap[paidKey];
          
          if (paidType) {
            const index = ctx.session.isPaid.indexOf(paidType);
            const isSelected = index !== -1;

            if (isSelected) {
              ctx.session.isPaid.splice(index, 1);
              logger.info(`Removed payment type: ${paidType}`);
            } else {
              ctx.session.isPaid.push(paidType);
              logger.info(`Added payment type: ${paidType}`);
            }
            
            await safeUpdateKeyboard(createPaymentKeyboard(ctx.session.isPaid));
          }
        }
      }

      if (data.startsWith('summary_')) {
        const action = data.replace('summary_', '');
        
        // Clear the auto-approve timeout
        if (ctx.session.summaryTimeoutId) {
          clearTimeout(ctx.session.summaryTimeoutId);
        }

        if (action === 'cancel') {
          // Delete the summary message
          if (ctx.chat?.id && ctx.session.summaryMessageId) {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, ctx.session.summaryMessageId);
            } catch (error) {
              logger.error('Failed to delete summary message:', error);
            }
          }
          await ctx.reply("❌ Tool save cancelled.");
        } else if (action === 'approve') {
          if (ctx.chat?.id && ctx.session.summaryMessageId) {
            try {
              // Show final summary with delete button
              const finalSummaryText = "✅ Tool approved and saved!\n\n<b>Summary:</b>\n" +
                `<b>Name:</b> ${ctx.session.initialTool?.name}\n` +
                `<b>URL:</b> ${ctx.session.initialTool?.url}\n` +
                `<b>Description:</b> ${ctx.session.initialTool?.description}\n` +
                `<b>Types:</b> ${ctx.session.types?.join(", ") || "Undefined"}\n` +
                `<b>API Services:</b> ${ctx.session.apiServices || "Undefined"}\n` +
                `<b>Payment:</b> ${ctx.session.isPaid?.join(", ") || "Undefined"}`;

              await ctx.api.editMessageText(
                ctx.chat.id,
                ctx.session.summaryMessageId,
                finalSummaryText,
                { 
                  parse_mode: "HTML",
                  reply_markup: createFinalSummaryKeyboard()
                }
              );

              // Auto-delete after 15 seconds
              setTimeout(async () => {
                try {
                  if (ctx.chat?.id && ctx.session.summaryMessageId) {
                    await ctx.api.deleteMessage(ctx.chat.id, ctx.session.summaryMessageId);
                  }
                } catch (error) {
                  logger.error('Failed to auto-delete final summary:', error);
                }
              }, CLEANUP_MESSAGE_TIMEOUT);

              // Clear the session
              ctx.session = {};
            } catch (error) {
              logger.error('Failed to update summary message:', error);
            }
          }
        } else if (action === 'delete_summary') {
          // Handle manual deletion
          if (ctx.chat?.id && ctx.callbackQuery.message?.message_id) {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
            } catch (error) {
              logger.error('Failed to delete summary message:', error);
            }
          }
        } else if (action === 'edit') {
          // Delete the summary message and restart the flow
          if (ctx.chat?.id && ctx.session.summaryMessageId) {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, ctx.session.summaryMessageId);
              
              // Delete the existing record from Airtable
              if (ctx.session.lastRecordId) {
                await airtableService.deleteTool(ctx.session.lastRecordId);
              }
            } catch (error) {
              logger.error('Failed to delete summary message or Airtable record:', error);
            }
          }
          // Keep the initial tool info but clear other selections
          const initialTool = ctx.session.initialTool;
          ctx.session = {
            initialTool,
            userId: ctx.from?.id,
            startTime: Date.now()
          };
          // Start the selection process again
          const message = await ctx.reply("Select types (multiple possible):", { 
            reply_markup: createTypesKeyboard() 
          });
          ctx.session.lastMessageId = message.message_id;
        }

        ctx.session.summaryTimeoutId = undefined;
        ctx.session.summaryMessageId = undefined;
      }

      if (data === 'abort') {
        const currentState = ctx.session.apiServices ? 'api' : 
                            ctx.session.types?.length ? 'types' : 
                            'start';
        
        const returnCallback = currentState === 'api' ? 'nav_api' :
                              currentState === 'types' ? 'nav_types' :
                              'nav_start';

        await ctx.editMessageText(
          "❓ Are you sure you want to cancel? All progress will be lost.",
          { reply_markup: createAbortConfirmationKeyboard(returnCallback) }
        );
        return;
      }

      if (data === 'abort_confirm') {
        // Delete the current message
        if (ctx.chat?.id && ctx.callbackQuery.message?.message_id) {
          try {
            await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
          } catch (error) {
            logger.error('Failed to delete message:', error);
          }
        }
        
        // Clear session
        ctx.session = {};
        
        // Send abort message
        const abortMessage = await ctx.reply("❌ Operation cancelled. Use /savetool to start over.");
        
        // Delete abort message after 5 seconds
        setTimeout(async () => {
          try {
            if (ctx.chat?.id) {
              await ctx.api.deleteMessage(ctx.chat.id, abortMessage.message_id);
            }
          } catch (error) {
            logger.error('Failed to delete abort message:', error);
          }
        }, 5000);
        
        return;
      }
    } catch (error) {
      logger.error('Error handling callback:', error);
      await ctx.reply("⚠️ Something went wrong. Please try again.").catch(() => {});
    }
  },

  // Error handler
  handleError: (err: any) => {
    const ctx = err.ctx;
    const error = err.error as Error;
    // Ignore timeout errors silently
    if (error.message.includes('query is too old') || 
        error.message.includes('query ID is invalid')) {
      return;
    }
    logger.error(`Error while handling update ${ctx.update.update_id}:`, error);
  }
}; 