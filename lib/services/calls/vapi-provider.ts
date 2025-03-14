import axios from 'axios';
import { CallProvider, CallOptions } from './types';

export class VAPICallProvider implements CallProvider {
  private client: typeof axios;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.VAPI_BASE_URL || 'https://api.vapi.ai/v1';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async makeCall(options: CallOptions): Promise<string> {
    try {
      const response = await this.client.post('/calls', {
        to: options.to,
        from: options.from,
        recording: options.recordingEnabled,
        transcription: options.transcriptionEnabled,
        webhook_url: options.callbackUrl || process.env.VAPI_DEFAULT_CALLBACK_URL,
        assistant_config: {
          voice: 'jennifer', // or any other VAPI supported voice
          language: 'en-US',
          initial_message: 'Hello, this is Dottie, your AI assistant.',
        },
      });

      return response.data.call_id;
    } catch (error) {
      console.error('Error making VAPI call:', error);
      throw error;
    }
  }

  async handleIncomingCall(callId: string, from: string): Promise<void> {
    try {
      await this.client.post(`/calls/${callId}/answer`, {
        assistant_config: {
          voice: 'jennifer',
          language: 'en-US',
          initial_message: 'Hello, this is Dottie, your AI assistant.',
        },
      });
    } catch (error) {
      console.error('Error handling incoming VAPI call:', error);
      throw error;
    }
  }

  async updateCallStatus(callId: string, status: string): Promise<void> {
    try {
      await this.client.patch(`/calls/${callId}`, {
        status: this.mapStatus(status),
      });
    } catch (error) {
      console.error('Error updating VAPI call status:', error);
      throw error;
    }
  }

  async handleRecording(callId: string, recordingUrl: string): Promise<void> {
    try {
      // VAPI might handle recordings differently, this is an example implementation
      await this.client.post(`/calls/${callId}/recordings`, {
        recording_url: recordingUrl,
      });
    } catch (error) {
      console.error('Error handling VAPI recording:', error);
      throw error;
    }
  }

  async handleTranscription(callId: string, transcription: string): Promise<void> {
    try {
      // VAPI might handle transcriptions differently, this is an example implementation
      await this.client.post(`/calls/${callId}/transcriptions`, {
        transcription,
      });
    } catch (error) {
      console.error('Error handling VAPI transcription:', error);
      throw error;
    }
  }

  generateCallResponse(options: {
    message?: string;
    recordingEnabled?: boolean;
    transcriptionEnabled?: boolean;
    gatherInput?: boolean;
  }): string {
    // VAPI uses a different format for call responses
    const response: any = {
      version: '1.0',
      actions: [],
    };

    if (options.message) {
      response.actions.push({
        type: 'speak',
        text: options.message,
        voice: 'jennifer',
      });
    }

    if (options.gatherInput) {
      response.actions.push({
        type: 'listen',
        timeout: 3000,
        endOnSilence: true,
      });
    }

    if (options.recordingEnabled) {
      response.actions.push({
        type: 'record',
        maxDuration: 3600, // 1 hour in seconds
        transcribe: options.transcriptionEnabled,
      });
    }

    return JSON.stringify(response);
  }

  private mapStatus(status: string): string {
    // Map our standard status to VAPI status
    const statusMap: { [key: string]: string } = {
      'initiated': 'starting',
      'ringing': 'ringing',
      'in-progress': 'in_progress',
      'completed': 'completed',
      'failed': 'failed',
      'busy': 'busy',
      'no-answer': 'no_answer',
    };

    return statusMap[status] || status;
  }

  // Additional VAPI-specific methods
  async getCallAnalytics(callId: string) {
    try {
      const response = await this.client.get(`/calls/${callId}/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error getting VAPI call analytics:', error);
      throw error;
    }
  }

  async updateAssistantConfig(callId: string, config: {
    voice?: string;
    language?: string;
    message?: string;
  }) {
    try {
      await this.client.patch(`/calls/${callId}/assistant`, config);
    } catch (error) {
      console.error('Error updating VAPI assistant config:', error);
      throw error;
    }
  }
}