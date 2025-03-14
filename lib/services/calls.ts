import twilio from 'twilio';
import { prisma } from '../db';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export interface CallOptions {
  to: string;
  from: string;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  callbackUrl?: string;
}

export interface ScheduledCallOptions extends CallOptions {
  scheduledTime: Date;
}

export class CallService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async makeCall(options: CallOptions) {
    try {
      const call = await client.calls.create({
        to: options.to,
        from: options.from,
        url: options.callbackUrl || process.env.TWILIO_DEFAULT_CALLBACK_URL,
        record: options.recordingEnabled,
        transcribeCallback: options.transcriptionEnabled
          ? process.env.TWILIO_TRANSCRIPTION_CALLBACK_URL
          : undefined,
      });

      return await prisma.call.create({
        data: {
          id: call.sid,
          phoneNumber: options.to,
          direction: 'outgoing',
          status: 'scheduled',
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
    // For now, we'll just store it in the database
    return scheduledCall;
  }

  async handleIncomingCall(callSid: string, from: string) {
    try {
      return await prisma.call.create({
        data: {
          id: callSid,
          phoneNumber: from,
          direction: 'incoming',
          status: 'completed',
          userId: this.userId,
        },
      });
    } catch (error) {
      console.error('Error handling incoming call:', error);
      throw error;
    }
  }

  async updateCallStatus(callSid: string, status: string) {
    try {
      return await prisma.call.update({
        where: { id: callSid },
        data: { status },
      });
    } catch (error) {
      console.error('Error updating call status:', error);
      throw error;
    }
  }

  async handleRecording(callSid: string, recordingUrl: string) {
    try {
      return await prisma.call.update({
        where: { id: callSid },
        data: { recordingUrl },
      });
    } catch (error) {
      console.error('Error handling recording:', error);
      throw error;
    }
  }

  async handleTranscription(callSid: string, transcription: string) {
    try {
      return await prisma.call.update({
        where: { id: callSid },
        data: { transcription },
      });
    } catch (error) {
      console.error('Error handling transcription:', error);
      throw error;
    }
  }

  async listCalls(options: {
    status?: string;
    direction?: 'incoming' | 'outgoing';
    startDate?: Date;
    endDate?: Date;
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

  generateTwiML(options: {
    message?: string;
    recordingEnabled?: boolean;
    transcriptionEnabled?: boolean;
    gatherInput?: boolean;
  } = {}) {
    const twiml = new twilio.twiml.VoiceResponse();

    if (options.message) {
      twiml.say(options.message);
    }

    if (options.gatherInput) {
      twiml.gather({
        input: 'speech dtmf',
        timeout: 3,
        numDigits: 1,
      });
    }

    if (options.recordingEnabled) {
      twiml.record({
        transcribe: options.transcriptionEnabled,
        maxLength: 3600, // 1 hour
        transcribeCallback: process.env.TWILIO_TRANSCRIPTION_CALLBACK_URL,
      });
    }

    return twiml.toString();
  }
}