import { prisma } from '../../db';
import { CallOptions, ScheduledCallOptions, CallProvider } from './types';
import { TwilioCallProvider } from './twilio-provider';
import { VAPICallProvider } from './vapi-provider';

export class CallService {
  private userId: string;
  private twilioProvider: TwilioCallProvider;
  private vapiProvider: VAPICallProvider;
  private defaultProvider: 'twilio' | 'vapi';

  constructor(userId: string, defaultProvider: 'twilio' | 'vapi' = 'twilio') {
    this.userId = userId;
    this.twilioProvider = new TwilioCallProvider();
    this.vapiProvider = new VAPICallProvider();
    this.defaultProvider = defaultProvider;
  }

  private getProvider(provider?: 'twilio' | 'vapi'): CallProvider {
    const selectedProvider = provider || this.defaultProvider;
    return selectedProvider === 'twilio' ? this.twilioProvider : this.vapiProvider;
  }

  async makeCall(options: CallOptions) {
    const provider = this.getProvider(options.provider);
    try {
      const callId = await provider.makeCall(options);

      return await prisma.call.create({
        data: {
          id: callId,
          phoneNumber: options.to,
          direction: 'outgoing',
          status: 'initiated',
          userId: this.userId,
        },
      });
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  async scheduleCall(options: ScheduledCallOptions) {
    // Store the scheduled call in the database
    const scheduledCall = await prisma.call.create({
      data: {
        phoneNumber: options.to,
        direction: 'outgoing',
        status: 'scheduled',
        scheduledTime: options.scheduledTime,
        userId: this.userId,
      },
    });

    // In a production environment, you would use a job queue system
    // like Bull to schedule the actual call at the specified time
    return scheduledCall;
  }

  async handleIncomingCall(callId: string, from: string, provider: 'twilio' | 'vapi') {
    const selectedProvider = this.getProvider(provider);
    try {
      await selectedProvider.handleIncomingCall(callId, from);

      return await prisma.call.create({
        data: {
          id: callId,
          phoneNumber: from,
          direction: 'incoming',
          status: 'in-progress',
          userId: this.userId,
        },
      });
    } catch (error) {
      console.error('Error handling incoming call:', error);
      throw error;
    }
  }

  async updateCallStatus(callId: string, status: string, provider: 'twilio' | 'vapi') {
    const selectedProvider = this.getProvider(provider);
    try {
      await selectedProvider.updateCallStatus(callId, status);

      return await prisma.call.update({
        where: { id: callId },
        data: { status },
      });
    } catch (error) {
      console.error('Error updating call status:', error);
      throw error;
    }
  }

  async handleRecording(callId: string, recordingUrl: string, provider: 'twilio' | 'vapi') {
    const selectedProvider = this.getProvider(provider);
    try {
      await selectedProvider.handleRecording(callId, recordingUrl);

      return await prisma.call.update({
        where: { id: callId },
        data: { recordingUrl },
      });
    } catch (error) {
      console.error('Error handling recording:', error);
      throw error;
    }
  }

  async handleTranscription(callId: string, transcription: string, provider: 'twilio' | 'vapi') {
    const selectedProvider = this.getProvider(provider);
    try {
      await selectedProvider.handleTranscription(callId, transcription);

      return await prisma.call.update({
        where: { id: callId },
        data: { transcription },
      });
    } catch (error) {
      console.error('Error handling transcription:', error);
      throw error;
    }
  }

  generateCallResponse(options: {
    message?: string;
    recordingEnabled?: boolean;
    transcriptionEnabled?: boolean;
    gatherInput?: boolean;
    provider: 'twilio' | 'vapi';
  }) {
    const selectedProvider = this.getProvider(options.provider);
    return selectedProvider.generateCallResponse(options);
  }

  async listCalls(options: {
    status?: string;
    direction?: 'incoming' | 'outgoing';
    startDate?: Date;
    endDate?: Date;
    provider?: 'twilio' | 'vapi';
  } = {}) {
    return prisma.call.findMany({
      where: {
        userId: this.userId,
        status: options.status,
        direction: options.direction,
        createdAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Provider-specific methods
  async getVAPICallAnalytics(callId: string) {
    return this.vapiProvider.getCallAnalytics(callId);
  }

  async updateVAPIAssistantConfig(callId: string, config: {
    voice?: string;
    language?: string;
    message?: string;
  }) {
    return this.vapiProvider.updateAssistantConfig(callId, config);
  }
}