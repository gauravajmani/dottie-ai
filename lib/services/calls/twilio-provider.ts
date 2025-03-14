import twilio from 'twilio';
import { CallProvider, CallOptions } from './types';

export class TwilioCallProvider implements CallProvider {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }

  async makeCall(options: CallOptions): Promise<string> {
    try {
      const call = await this.client.calls.create({
        to: options.to,
        from: options.from,
        url: options.callbackUrl || process.env.TWILIO_DEFAULT_CALLBACK_URL,
        record: options.recordingEnabled,
        transcribeCallback: options.transcriptionEnabled
          ? process.env.TWILIO_TRANSCRIPTION_CALLBACK_URL
          : undefined,
      });

      return call.sid;
    } catch (error) {
      console.error('Error making Twilio call:', error);
      throw error;
    }
  }

  async handleIncomingCall(callId: string, from: string): Promise<void> {
    try {
      await this.client.calls(callId).fetch();
      // Additional handling as needed
    } catch (error) {
      console.error('Error handling incoming Twilio call:', error);
      throw error;
    }
  }

  async updateCallStatus(callId: string, status: string): Promise<void> {
    try {
      await this.client.calls(callId).update({
        status: this.mapStatus(status),
      });
    } catch (error) {
      console.error('Error updating Twilio call status:', error);
      throw error;
    }
  }

  async handleRecording(callId: string, recordingUrl: string): Promise<void> {
    // Twilio automatically handles recordings, but we can add additional processing here
    console.log(`Recording URL for call ${callId}: ${recordingUrl}`);
  }

  async handleTranscription(callId: string, transcription: string): Promise<void> {
    // Twilio automatically handles transcriptions, but we can add additional processing here
    console.log(`Transcription for call ${callId}: ${transcription}`);
  }

  generateCallResponse(options: {
    message?: string;
    recordingEnabled?: boolean;
    transcriptionEnabled?: boolean;
    gatherInput?: boolean;
  }): string {
    const twiml = new twilio.twiml.VoiceResponse();

    if (options.message) {
      twiml.say({
        voice: 'alice',
        language: 'en-US',
      }, options.message);
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

  private mapStatus(status: string): string {
    // Map our standard status to Twilio status
    const statusMap: { [key: string]: string } = {
      'initiated': 'queued',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'failed': 'failed',
      'busy': 'busy',
      'no-answer': 'no-answer',
    };

    return statusMap[status] || status;
  }
}