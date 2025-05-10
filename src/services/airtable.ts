import Airtable from "airtable";
import { AirtableTool, logger } from "../types";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Debug logs
console.log('Airtable Service - Environment variables:', {
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? 'exists' : 'missing',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? 'exists' : 'missing'
});

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be provided!");
}

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

interface OldTool {
  category: string;
  url: string;
  description: string;
}

interface CompleteTool {
  name: string;
  url: string;
  types: string[];
  description: string;
  state: string;
  apiServices: string;
  isPaid: string[];
}

export const airtableService = {
  async saveTool(tool: CompleteTool) {
    try {
      const record = await airtable('Pintegram').create([{
        fields: {
          'Name': tool.name,
          'URL': tool.url,
          'Types': tool.types,
          'Description': tool.description,
          'State': tool.state,
          'API Services': tool.apiServices,
          'isPaid': tool.isPaid
        }
      }]);
      return record[0];
    } catch (error) {
      logger.error('Error saving tool:', error);
      throw error;
    }
  },

  async deleteTool(id: string) {
    try {
      await airtable('Pintegram').destroy(id);
    } catch (error) {
      logger.error('Error deleting tool:', error);
      throw error;
    }
  },

  async getTools(category?: string): Promise<AirtableTool[]> {
    try {
      const records = await airtable('Tools')
        .select({
          filterByFormula: category ? `{Type} = '${category}'` : '',
          sort: [{ field: 'Tool URL', direction: 'asc' }],
          view: 'Grid view'
        })
        .all();

      return records.map(record => ({
        id: record.id,
        name: record.get('Name') as string,
        types: record.get('Types') as string[],
        description: record.get('Description') as string,
        state: record.get('State') as string,
        apiServices: record.get('API Services') as string,
        isPaid: record.get('isPaid') as string[]
      }));
    } catch (error) {
      logger.error('Error fetching tools:', error);
      throw error;
    }
  },

  async getToolById(id: string): Promise<AirtableTool | null> {
    try {
      const record = await airtable('Tools').find(id);
      return {
        id: record.id,
        name: record.get('Name') as string,
        types: record.get('Types') as string[],
        description: record.get('Description') as string,
        state: record.get('State') as string,
        apiServices: record.get('API Services') as string,
        isPaid: record.get('isPaid') as string[]
      };
    } catch (error) {
      logger.error('Error fetching tool:', error);
      return null;
    }
  }
};
