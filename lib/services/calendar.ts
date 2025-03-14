import { google } from 'googleapis';
import axios from 'axios';
import { prisma } from '../db';
import { addMinutes, parseISO, format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    until?: Date;
    count?: number;
    byDay?: string[];
  };
}

export class CalendarService {
  private userId: string;
  private timezone: string;

  constructor(userId: string, timezone: string = 'UTC') {
    this.userId = userId;
    this.timezone = timezone;
  }

  private async getGoogleCalendarClient() {
    const account = await prisma.emailAccount.findFirst({
      where: {
        userId: this.userId,
        provider: 'gmail',
      },
    });

    if (!account) {
      throw new Error('Google account not found');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  private async getOutlookCalendarClient() {
    const account = await prisma.emailAccount.findFirst({
      where: {
        userId: this.userId,
        provider: 'outlook',
      },
    });

    if (!account) {
      throw new Error('Outlook account not found');
    }

    return axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0/me/calendar',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    });
  }

  async listEvents(options: {
    startTime?: Date;
    endTime?: Date;
    maxResults?: number;
  } = {}) {
    const events: CalendarEvent[] = [];

    try {
      // Get Google Calendar events
      const googleCalendar = await this.getGoogleCalendarClient();
      const googleEvents = await googleCalendar.events.list({
        calendarId: 'primary',
        timeMin: options.startTime?.toISOString(),
        timeMax: options.endTime?.toISOString(),
        maxResults: options.maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      events.push(
        ...(googleEvents.data.items?.map(this.parseGoogleEvent.bind(this)) || [])
      );
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
    }

    try {
      // Get Outlook Calendar events
      const outlookCalendar = await this.getOutlookCalendarClient();
      const outlookEvents = await outlookCalendar.get('/events', {
        params: {
          startDateTime: options.startTime?.toISOString(),
          endDateTime: options.endTime?.toISOString(),
          $top: options.maxResults,
        },
      });

      events.push(
        ...(outlookEvents.data.value?.map(this.parseOutlookEvent.bind(this)) || [])
      );
    } catch (error) {
      console.error('Error fetching Outlook Calendar events:', error);
    }

    return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async createEvent(event: Omit<CalendarEvent, 'id'>) {
    try {
      // Create in Google Calendar
      const googleCalendar = await this.getGoogleCalendarClient();
      await googleCalendar.events.insert({
        calendarId: 'primary',
        requestBody: this.createGoogleEventBody(event),
      });
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
    }

    try {
      // Create in Outlook Calendar
      const outlookCalendar = await this.getOutlookCalendarClient();
      await outlookCalendar.post('/events', this.createOutlookEventBody(event));
    } catch (error) {
      console.error('Error creating Outlook Calendar event:', error);
    }

    // Store in our database
    return prisma.event.create({
      data: {
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        isRecurring: !!event.recurrence,
        recurrence: event.recurrence || null,
        userId: this.userId,
      },
    });
  }

  async findAvailableSlots(duration: number, preferences: {
    startTime?: Date;
    endTime?: Date;
    daysOfWeek?: number[];
  } = {}) {
    const events = await this.listEvents({
      startTime: preferences.startTime || new Date(),
      endTime: preferences.endTime || addMinutes(new Date(), 60 * 24 * 7), // One week from now
    });

    // Implementation of finding available time slots
    // This would involve complex logic to:
    // 1. Consider working hours
    // 2. Consider timezone
    // 3. Find gaps between existing events
    // 4. Consider meeting duration
    // 5. Apply user preferences
    throw new Error('Not implemented');
  }

  private parseGoogleEvent(event: any): CalendarEvent {
    return {
      id: event.id,
      title: event.summary,
      description: event.description,
      startTime: parseISO(event.start.dateTime || event.start.date),
      endTime: parseISO(event.end.dateTime || event.end.date),
      location: event.location,
      attendees: event.attendees?.map((a: any) => a.email),
      // Parse recurrence rules if present
      recurrence: event.recurrence ? this.parseRecurrenceRule(event.recurrence[0]) : undefined,
    };
  }

  private parseOutlookEvent(event: any): CalendarEvent {
    return {
      id: event.id,
      title: event.subject,
      description: event.bodyPreview,
      startTime: parseISO(event.start.dateTime),
      endTime: parseISO(event.end.dateTime),
      location: event.location?.displayName,
      attendees: event.attendees?.map((a: any) => a.emailAddress.address),
      // Parse recurrence rules if present
      recurrence: event.recurrence ? this.parseOutlookRecurrence(event.recurrence) : undefined,
    };
  }

  private createGoogleEventBody(event: Omit<CalendarEvent, 'id'>): any {
    return {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: this.timezone,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: this.timezone,
      },
      location: event.location,
      attendees: event.attendees?.map(email => ({ email })),
      recurrence: event.recurrence ? [this.createRecurrenceRule(event.recurrence)] : undefined,
    };
  }

  private createOutlookEventBody(event: Omit<CalendarEvent, 'id'>): any {
    return {
      subject: event.title,
      body: {
        contentType: 'HTML',
        content: event.description || '',
      },
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: this.timezone,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: this.timezone,
      },
      location: {
        displayName: event.location || '',
      },
      attendees: event.attendees?.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      recurrence: event.recurrence ? this.createOutlookRecurrence(event.recurrence) : null,
    };
  }

  private parseRecurrenceRule(rule: string): CalendarEvent['recurrence'] {
    // Implementation of RRULE parsing
    throw new Error('Not implemented');
  }

  private createRecurrenceRule(recurrence: NonNullable<CalendarEvent['recurrence']>): string {
    // Implementation of RRULE creation
    throw new Error('Not implemented');
  }

  private parseOutlookRecurrence(recurrence: any): CalendarEvent['recurrence'] {
    // Implementation of Outlook recurrence parsing
    throw new Error('Not implemented');
  }

  private createOutlookRecurrence(recurrence: NonNullable<CalendarEvent['recurrence']>): any {
    // Implementation of Outlook recurrence creation
    throw new Error('Not implemented');
  }
}