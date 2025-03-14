import { TwilioCallProvider } from './twilio-provider';
import { VAPICallProvider } from './vapi-provider';
import {
  CallOptions,
  CallProvider,
  CallStatus,
  ScheduledCallOptions,
  ConferenceOptions,
  Conference,
  CallAnalytics,
} from './types';
import { prisma } from '@/lib/prisma';
import { addMinutes, isBefore } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

export class CallService {
  private provider: CallProvider;
  private userId: string;

  constructor(userId: string, providerType: 'twilio' | 'vapi' = 'twilio') {
    this.userId = userId;
    this.provider = this.createProvider(providerType);
  }

  private createProvider(type: 'twilio' | 'vapi'): CallProvider {
    switch (type) {
      case 'twilio':
        return new TwilioCallProvider();
      case 'vapi':
        return new VAPICallProvider();
      default:
        throw new Error('Invalid provider');
    }
  }

  async makeCall(options: CallOptions): Promise<string> {
    try {
      const callId = await this.provider.makeCall(options);
      await this.saveCall(callId, options);
      return callId;
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  async scheduleCall(options: ScheduledCallOptions): Promise<string> {
    try {
      if (!this.provider.scheduleCall) {
        throw new Error('Provider does not support call scheduling');
      }

      const utcScheduledTime = zonedTimeToUtc(options.scheduledTime, options.timezone);
      
      if (isBefore(utcScheduledTime, new Date())) {
        throw new Error('Cannot schedule call in the past');
      }

      const callId = await this.provider.scheduleCall(options);
      
      await prisma.scheduledCall.create({
        data: {
          id: callId,
          userId: this.userId,
          to: options.to,
          from: options.from,
          scheduledTime: utcScheduledTime,
          timezone: options.timezone,
          recurrence: options.recurrence,
          reminder: options.reminder,
          provider: options.provider || 'twilio',
          status: 'scheduled',
        },
      });

      if (options.reminder?.enabled) {
        await this.scheduleReminder(callId, options);
      }

      return callId;
    } catch (error) {
      console.error('Error scheduling call:', error);
      throw error;
    }
  }

  private async scheduleReminder(callId: string, options: ScheduledCallOptions): Promise<void> {
    if (!options.reminder?.enabled) return;

    const reminderTime = addMinutes(
      options.scheduledTime,
      -options.reminder.minutesBefore
    );

    await prisma.reminder.create({
      data: {
        scheduledCallId: callId,
        scheduledTime: reminderTime,
        method: options.reminder.method,
        status: 'pending',
      },
    });
  }

  async createConference(options: ConferenceOptions): Promise<string> {
    try {
      if (!this.provider.createConference) {
        throw new Error('Provider does not support conference calls');
      }

      const conferenceId = await this.provider.createConference(options);
      
      await prisma.conference.create({
        data: {
          id: conferenceId,
          userId: this.userId,
          name: options.name,
          status: 'scheduled',
          provider: options.provider || 'twilio',
          participants: {
            create: options.participants.map(phoneNumber => ({
              phoneNumber,
              status: 'invited',
              muted: options.muteOnEntry || false,
            })),
          },
          maxParticipants: options.maxParticipants,
          recordingEnabled: options.recordingEnabled,
          transcriptionEnabled: options.transcriptionEnabled,
          waitingRoom: options.waitingRoom,
          muteOnEntry: options.muteOnEntry,
        },
      });

      // Start inviting participants
      for (const participant of options.participants) {
        await this.provider.addParticipantToConference!(conferenceId, participant);
      }

      return conferenceId;
    } catch (error) {
      console.error('Error creating conference:', error);
      throw error;
    }
  }

  async addParticipantToConference(conferenceId: string, participant: string): Promise<void> {
    try {
      if (!this.provider.addParticipantToConference) {
        throw new Error('Provider does not support conference calls');
      }

      const participantId = await this.provider.addParticipantToConference(
        conferenceId,
        participant
      );

      await prisma.conferenceParticipant.create({
        data: {
          id: participantId,
          conferenceId,
          phoneNumber: participant,
          status: 'invited',
          muted: false,
        },
      });
    } catch (error) {
      console.error('Error adding participant to conference:', error);
      throw error;
    }
  }

  async removeParticipantFromConference(conferenceId: string, participantId: string): Promise<void> {
    try {
      if (!this.provider.removeParticipantFromConference) {
        throw new Error('Provider does not support conference calls');
      }

      await this.provider.removeParticipantFromConference(conferenceId, participantId);
      
      await prisma.conferenceParticipant.update({
        where: { id: participantId },
        data: {
          status: 'disconnected',
          leftAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error removing participant from conference:', error);
      throw error;
    }
  }

  async muteParticipant(conferenceId: string, participantId: string, mute: boolean): Promise<void> {
    try {
      if (!this.provider.muteParticipant) {
        throw new Error('Provider does not support conference calls');
      }

      await this.provider.muteParticipant(conferenceId, participantId, mute);
      
      await prisma.conferenceParticipant.update({
        where: { id: participantId },
        data: { muted: mute },
      });
    } catch (error) {
      console.error('Error muting participant:', error);
      throw error;
    }
  }

  async endConference(conferenceId: string): Promise<void> {
    try {
      if (!this.provider.endConference) {
        throw new Error('Provider does not support conference calls');
      }

      await this.provider.endConference(conferenceId);
      
      await prisma.conference.update({
        where: { id: conferenceId },
        data: {
          status: 'completed',
          endTime: new Date(),
        },
      });
    } catch (error) {
      console.error('Error ending conference:', error);
      throw error;
    }
  }

  async handleIncomingCall(callId: string, from: string): Promise<any> {
    return this.provider.handleIncomingCall(callId, from);
  }

  async updateCallStatus(callId: string, status: CallStatus): Promise<void> {
    await this.provider.updateCallStatus(callId, status);
    await this.updateCallRecord(callId, { status });
  }

  async handleRecording(callId: string, recordingUrl: string): Promise<void> {
    await this.provider.handleRecording(callId, recordingUrl);
    await this.updateCallRecord(callId, { recordingUrl });
  }

  async handleTranscription(callId: string, transcription: string): Promise<void> {
    await this.provider.handleTranscription(callId, transcription);
    await this.updateCallRecord(callId, { transcription });
  }

  async getCallAnalytics(callId: string): Promise<CallAnalytics | null> {
    if (!this.provider.getCallAnalytics) {
      return null;
    }

    try {
      const analytics = await this.provider.getCallAnalytics(callId);
      await this.updateCallRecord(callId, { analytics });
      return analytics;
    } catch (error) {
      console.error('Error getting call analytics:', error);
      return null;
    }
  }

  private async saveCall(callId: string, options: CallOptions): Promise<void> {
    await prisma.call.create({
      data: {
        id: callId,
        userId: this.userId,
        to: options.to,
        from: options.from,
        provider: options.provider || 'twilio',
        recordingEnabled: options.recordingEnabled,
        transcriptionEnabled: options.transcriptionEnabled,
        status: 'queued',
      },
    });
  }

  private async updateCallRecord(callId: string, data: any): Promise<void> {
    await prisma.call.update({
      where: { id: callId },
      data,
    });
  }

  async listCalls(options?: {
    status?: CallStatus;
    from?: string;
    to?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    return prisma.call.findMany({
      where: {
        userId: this.userId,
        ...(options?.status && { status: options.status }),
        ...(options?.from && { from: options.from }),
        ...(options?.to && { to: options.to }),
        ...(options?.startDate && options?.endDate && {
          createdAt: {
            gte: options.startDate,
            lte: options.endDate,
          },
        }),
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listConferences(options?: {
    status?: 'scheduled' | 'in-progress' | 'completed';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Conference[]> {
    return prisma.conference.findMany({
      where: {
        userId: this.userId,
        ...(options?.status && { status: options.status }),
        ...(options?.startDate && options?.endDate && {
          startTime: {
            gte: options.startDate,
            lte: options.endDate,
          },
        }),
      },
      include: {
        participants: true,
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { startTime: 'desc' },
    });
  }
}