import Airtable from "airtable";
import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

const airtable = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
});

const getTableSchema = async () => {
    try {
        const response = await axios.get(
            `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`
                }
            }
        );
        console.log('Full table schema:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error fetching schema:', error);
    }
};

const testSchema = async () => {
    try {
        const base = airtable.base(process.env.AIRTABLE_BASE_ID!);
        const table = base('Pintegram');
        
        // First get a sample record to see fields
        const records = await table.select({
            maxRecords: 1,
            view: "Grid view"
        }).all();

        if (records.length > 0) {
            const record = records[0];
            console.log('Fields in record:', Object.keys(record.fields));
            console.log('Sample data:', record.fields);
            console.log('Record ID:', record.id);
            console.log('Created time:', record._rawJson.createdTime);
        }

        // Get full schema
        await getTableSchema();

    } catch (error) {
        console.error('Error fetching schema:', error);
    }
};

testSchema();
