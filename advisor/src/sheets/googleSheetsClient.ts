import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export class GoogleSheetsClient {
    private auth;
    private sheets;
    private spreadsheetId: string;

    constructor() {
        const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || "{}");
        this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";

        this.auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });
        
        this.sheets = google.sheets({ version: "v4", auth: this.auth });
    }

    async readRange(range: string): Promise<string[][]> {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range,
            });
            return response.data.values || [];
        } catch (error) {
            console.error("Error reading from Google Sheets:", error);
            throw new Error("Failed to read from Google Sheets");
        }
    }
}