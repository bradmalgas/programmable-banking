import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export class GoogleSheetsClient {
    private auth;
    private sheets;
    private spreadsheetId: string;

    constructor() {
        try {
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
            }
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            this.auth = new google.auth.GoogleAuth({
                credentials,
                scopes: SCOPES,
            });
        } catch (error) {
            throw new Error(`Failed to initialize auth: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
            this.spreadsheetId = process.env.SPREADSHEET_ID;
            if (!this.spreadsheetId) {
                throw new Error("SPREADSHEET_ID environment variable is not set");
            }
        } catch (error) {
            throw new Error(`Failed to set spreadsheet ID: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
            this.sheets = google.sheets({ version: "v4", auth: this.auth });
        } catch (error) {
            throw new Error(`Failed to initialize sheets client: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async readRange(range: string): Promise<string[][]> {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range,
            });
            return response.data.values || [];
        } catch (error) {
            throw new Error("Failed to read from Google Sheets");
        }
    }
}