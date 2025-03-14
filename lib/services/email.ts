import { google } from 'googleapis';
import axios from 'axios';
import { prisma } from '../db';

export interface EmailConfig {
  provider: 'gmail' | 'outlook';
  userId: string;
}

export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: Date;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export class EmailService {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  private async getEmailAccount() {
    const account = await prisma.emailAccount.findFirst({
      where: {
        userId: this.config.userId,
        provider: this.config.provider,
      },
    });

    if (!account) {
      throw new Error('Email account not found');
    }

    return account;
  }

  private async getGmailClient() {
    const account = await this.getEmailAccount();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  private async getOutlookClient() {
    const account = await this.getEmailAccount();
    return axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0/me',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    });
  }

  async listEmails(options: { maxResults?: number; query?: string } = {}) {
    if (this.config.provider === 'gmail') {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: options.maxResults || 10,
        q: options.query,
      });

      const emails = await Promise.all(
        response.data.messages?.map(async (message) => {
          const details = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
          });

          return this.parseGmailMessage(details.data);
        }) || []
      );

      return emails;
    } else {
      const outlook = await this.getOutlookClient();
      const response = await outlook.get('/messages', {
        params: {
          $top: options.maxResults || 10,
          $filter: options.query,
        },
      });

      return response.data.value.map(this.parseOutlookMessage);
    }
  }

  async sendEmail(email: Omit<Email, 'id' | 'date'>) {
    if (this.config.provider === 'gmail') {
      const gmail = await this.getGmailClient();
      const message = this.createGmailMessage(email);

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });
    } else {
      const outlook = await this.getOutlookClient();
      await outlook.post('/sendMail', {
        message: this.createOutlookMessage(email),
      });
    }
  }

  async scheduleEmail(email: Omit<Email, 'id' | 'date'>, scheduledTime: Date) {
    // Implementation depends on your scheduling system
    // Could use a job queue like Bull or a cloud function
    throw new Error('Not implemented');
  }

  private parseGmailMessage(message: any): Email {
    // Implementation of Gmail message parsing
    throw new Error('Not implemented');
  }

  private parseOutlookMessage(message: any): Email {
    // Implementation of Outlook message parsing
    throw new Error('Not implemented');
  }

  private createGmailMessage(email: Omit<Email, 'id' | 'date'>): string {
    // Implementation of Gmail message creation
    throw new Error('Not implemented');
  }

  private createOutlookMessage(email: Omit<Email, 'id' | 'date'>): any {
    // Implementation of Outlook message creation
    throw new Error('Not implemented');
  }
}