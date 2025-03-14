export interface CallOptions {
  to: string;
  from: string;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  callbackUrl?: string;
  provider?: 'twilio' | 'vapi';
}

export interface ScheduledCallOptions extends CallOptions {
  scheduledTime: Date;
}

export interface CallProvider {
  makeCall(options: CallOptions): Promise<string>; // Returns call ID
  handleIncomingCall(callId: string, from: string): Promise<void>;
  updateCallStatus(callId: string, status: string): Promise<void>;
  handleRecording(callId: string, recordingUrl: string): Promise<void>;
  handleTranscription(callId: string, transcription: string): Promise<void>;
  generateCallResponse(options: {
    message?: string;
    recordingEnabled?: boolean;
    transcriptionEnabled?: boolean;
    gatherInput?: boolean;
  }): string;
}

export interface CallStatus {
  id: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  duration?: number;
  recordingUrl?: string;
  transcription?: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  provider: 'twilio' | 'vapi';
  timestamp: Date;
}