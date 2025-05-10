import { Context } from "grammy";
import { handlers, ToolSession, MyContext } from "../handlers/telegram";
import { airtableService } from "../services/airtable";

// Mock airtable service
jest.mock("../services/airtable", () => ({
  airtableService: {
    saveTool: jest.fn()
  }
}));

describe("Telegram Handlers", () => {
  let mockCtx: Partial<MyContext>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock context
    mockCtx = {
      reply: jest.fn(),
      editMessageText: jest.fn(),
      answerCallbackQuery: jest.fn(),
      from: { id: 123 },
      chat: { id: 456 },
      session: {},
      api: {
        deleteMessage: jest.fn(),
        getChat: jest.fn()
      }
    };
  });

  describe("Session Timeout", () => {
    it("should expire session after 2 minutes", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockImplementation(() => now);

      // Start a session
      mockCtx.message = { text: "/savetool testTool https://test.com description" };
      await handlers.saveTool(mockCtx as MyContext);

      // Verify session started
      expect(mockCtx.session.startTime).toBe(now);
      expect(mockCtx.session.initialTool).toBeDefined();

      // Move time forward 2 minutes and 1 second
      jest.spyOn(Date, "now").mockImplementation(() => now + 2 * 60 * 1000 + 1);

      // Try to interact
      mockCtx.callbackQuery = { data: "confirm_yes" };
      await handlers.handleCallback(mockCtx as MyContext);

      // Verify timeout message and session cleanup
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Session expired")
      );
      expect(mockCtx.session).toEqual({});
    });

    it("should allow interaction within 2 minutes", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockImplementation(() => now);

      // Start a session
      mockCtx.message = { text: "/savetool testTool https://test.com description" };
      await handlers.saveTool(mockCtx as MyContext);

      // Move time forward 1 minute
      jest.spyOn(Date, "now").mockImplementation(() => now + 1 * 60 * 1000);

      // Try to interact
      mockCtx.callbackQuery = { data: "confirm_yes" };
      await handlers.handleCallback(mockCtx as MyContext);

      // Verify interaction was allowed
      expect(mockCtx.reply).not.toHaveBeenCalledWith(
        expect.stringContaining("Session expired")
      );
    });
  });

  describe("User Validation", () => {
    it("should prevent different user from interacting", async () => {
      // Start session with user 123
      mockCtx.message = { text: "/savetool testTool https://test.com description" };
      await handlers.saveTool(mockCtx as MyContext);

      // Try to interact with different user (456)
      mockCtx.from = { id: 456 };
      mockCtx.callbackQuery = { data: "confirm_yes" };
      await handlers.handleCallback(mockCtx as MyContext);

      // Verify unauthorized message
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith({
        text: expect.stringContaining("Only the person who started"),
        show_alert: true
      });
    });

    it("should allow same user to interact", async () => {
      // Start session with user 123
      mockCtx.message = { text: "/savetool testTool https://test.com description" };
      await handlers.saveTool(mockCtx as MyContext);

      // Try to interact with same user
      mockCtx.callbackQuery = { data: "confirm_yes" };
      await handlers.handleCallback(mockCtx as MyContext);

      // Verify interaction was allowed
      expect(mockCtx.answerCallbackQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("Only the person who started")
        })
      );
    });
  });

  describe("Cleanup Messages", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should delete timeout message after 15 seconds", async () => {
      // Create expired session
      mockCtx.session = {
        startTime: Date.now() - 3 * 60 * 1000, // 3 minutes ago
        userId: 123
      };

      // Trigger timeout
      mockCtx.callbackQuery = { data: "confirm_yes" };
      await handlers.handleCallback(mockCtx as MyContext);

      // Fast forward 15 seconds
      jest.advanceTimersByTime(15000);

      // Verify message deletion
      expect(mockCtx.api.deleteMessage).toHaveBeenCalled();
    });
  });
}); 