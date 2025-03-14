import { NextRequest, NextResponse } from 'next/server';
import { CallService } from '@/lib/services/calls/call-service';
import { CallStatus } from '@/lib/services/calls/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      callId,
      from,
      status,
      recordingUrl,
      transcription,
      analytics,
      event,
    } = body;

    const callService = new CallService('system', 'vapi');

    // Handle different webhook events
    switch (event) {
      case 'call.incoming':
        const response = await callService.handleIncomingCall(callId, from);
        return NextResponse.json(response);

      case 'call.status':
        if (status) {
          await callService.updateCallStatus(callId, status as CallStatus);
        }
        break;

      case 'call.recording':
        if (recordingUrl) {
          await callService.handleRecording(callId, recordingUrl);
        }
        break;

      case 'call.transcription':
        if (transcription) {
          await callService.handleTranscription(callId, transcription);
        }
        break;

      case 'call.analytics':
        if (analytics) {
          await callService.updateVAPICallAnalytics(callId, analytics);
        }
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('VAPI webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}