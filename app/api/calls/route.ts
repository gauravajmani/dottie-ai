import { NextRequest, NextResponse } from 'next/server';
import { CallService } from '@/lib/services/calls/call-service';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const callService = new CallService(session.user.id);
    const calls = await callService.listCalls();

    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      to,
      from,
      provider,
      recordingEnabled,
      transcriptionEnabled,
    } = body;

    if (!to || !from) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const callService = new CallService(session.user.id, provider);
    const callId = await callService.makeCall({
      to,
      from,
      recordingEnabled,
      transcriptionEnabled,
    });

    return NextResponse.json({ callId });
  } catch (error) {
    console.error('Error making call:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}