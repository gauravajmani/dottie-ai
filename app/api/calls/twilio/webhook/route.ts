import { NextRequest, NextResponse } from 'next/server';
import { CallService } from '@/lib/services/calls/call-service';
import { CallStatus } from '@/lib/services/calls/types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const status = formData.get('CallStatus') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const transcription = formData.get('TranscriptionText') as string;

    const callService = new CallService('system', 'twilio');

    // Handle different webhook types
    if (status === 'ringing') {
      const response = await callService.handleIncomingCall(callSid, from);
      return new NextResponse(response, {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    if (status) {
      await callService.updateCallStatus(callSid, status as CallStatus);
    }

    if (recordingUrl) {
      await callService.handleRecording(callSid, recordingUrl);
    }

    if (transcription) {
      await callService.handleTranscription(callSid, transcription);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}