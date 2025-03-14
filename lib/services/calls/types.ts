export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'scheduled';

export interface CallOptions {
  to: string;
  from: string;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  provider?: 'twilio' | 'vapi';
  message?: string;
  gatherInput?: boolean;
  maxLength?: number;
}

export interface ScheduledCallOptions extends CallOptions {
  scheduledTime: Date;
  timezone: string;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[];
  };
  reminder?: {
    enabled: boolean;
    minutesBefore: number;
    method: 'sms' | 'email' | 'both';
  };
}

export interface ConferenceOptions {
  name: string;
  participants: string[];
  from: string;
  moderator?: string;
  maxParticipants?: number;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  provider?: 'twilio' | 'vapi';
  waitingRoom?: boolean;
  muteOnEntry?: boolean;
}

export interface ConferenceParticipant {
  id: string;
  phoneNumber: string;
  status: 'invited' | 'waiting' | 'connected' | 'disconnected';
  muted: boolean;
  joinedAt?: Date;
  leftAt?: Date;
}

export interface Conference {
  id: string;
  name: string;
  status: 'scheduled' | 'in-progress' | 'completed';
  participants: ConferenceParticipant[];
  recordingUrl?: string;
  transcription?: string;
  startTime: Date;
  endTime?: Date;
  provider: 'twilio' | 'vapi';
}

export interface CallAnalytics {
  duration: number;
  sentiment?: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
    breakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  keywords?: string[];
  topics?: string[];
  speakerRatio?: {
    agent: number;
    customer: number;
  };
  interruptions?: number;
  silenceDuration?: number;
  pace?: {
    wordsPerMinute: number;
    rating: 'slow' | 'normal' | 'fast';
  };
}

export interface CallProvider {
  makeCall(options: CallOptions): Promise<string>;
  handleIncomingCall(callId: string, from: string): Promise<any>;
  updateCallStatus(callId: string, status: CallStatus): Promise<void>;
  handleRecording(callId: string, recordingUrl: string): Promise<void>;
  handleTranscription(callId: string, transcription: string): Promise<void>;
  generateCallResponse(options: CallOptions): Promise<any>;
  scheduleCall?(options: ScheduledCallOptions): Promise<string>;
  createConference?(options: ConferenceOptions): Promise<string>;
  addParticipantToConference?(conferenceId: string, participant: string): Promise<string>;
  removeParticipantFromConference?(conferenceId: string, participantId: string): Promise<void>;
  muteParticipant?(conferenceId: string, participantId: string, mute: boolean): Promise<void>;
  endConference?(conferenceId: string): Promise<void>;
  getCallAnalytics?(callId: string): Promise<CallAnalytics>;
}