import { NextRequest, NextResponse } from 'next/server';
import { VoiceAnalysisService } from '@/lib/services/calls/voice-analysis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

const analyzeVoiceSchema = z.object({
  audioUrl: z.string().url(),
  callId: z.string().optional(),
  generateInsights: z.boolean().default(true),
});

const getAnalyticsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  view: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Rate limiting
    const identifier = `voice-analysis-${session.user.id}`;
    const { success } = await rateLimit(identifier);
    if (!success) {
      return new NextResponse('Too many requests', { status: 429 });
    }

    const json = await req.json();
    const { audioUrl, callId, generateInsights } = analyzeVoiceSchema.parse(json);

    const voiceAnalysisService = new VoiceAnalysisService();
    const analysis = await voiceAnalysisService.analyzeVoice(audioUrl);

    let insights = null;
    if (generateInsights) {
      insights = await voiceAnalysisService.generateInsights(analysis);
    }

    // Store analysis results
    if (callId) {
      await prisma.callAnalysis.create({
        data: {
          callId,
          userId: session.user.id,
          analysis: analysis as any,
          insights,
          createdAt: new Date(),
        },
      });
    }

    return NextResponse.json({ analysis, insights });
  } catch (error) {
    console.error('Voice analysis error:', error);
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request data', { status: 400 });
    }
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = getAnalyticsSchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      view: searchParams.get('view') || 'daily',
    });

    // Cache key based on parameters
    const cacheKey = `voice-analytics-${session.user.id}-${params.startDate}-${params.endDate}-${params.view}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(JSON.parse(cachedData));
    }

    // Fetch analytics from database
    const analyses = await prisma.callAnalysis.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(params.startDate),
          lte: new Date(params.endDate),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by time period based on view
    const groupedAnalytics = analyses.reduce((acc, analysis) => {
      let key;
      const date = analysis.createdAt;
      
      switch (params.view) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const week = Math.floor(date.getDate() / 7);
          key = `${date.getFullYear()}-W${week}`;
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          break;
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(analysis);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate aggregates
    const analytics = Object.entries(groupedAnalytics).map(([period, items]) => {
      const averages = items.reduce((acc, item) => {
        const analysis = item.analysis as any;
        acc.pitch += analysis.pitch;
        acc.energy += analysis.energy;
        acc.clarity += analysis.clarity;
        acc.tempo += analysis.tempo;
        acc.variability += analysis.variability;
        return acc;
      }, { pitch: 0, energy: 0, clarity: 0, tempo: 0, variability: 0 });

      const count = items.length;
      return {
        period,
        metrics: {
          pitch: averages.pitch / count,
          energy: averages.energy / count,
          clarity: averages.clarity / count,
          tempo: averages.tempo / count,
          variability: averages.variability / count,
        },
        emotions: items.map(item => (item.analysis as any).emotion),
        count,
      };
    });

    // Cache results for 5 minutes
    await redis.set(cacheKey, JSON.stringify({ analytics }), 'EX', 300);

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Voice analytics error:', error);
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request data', { status: 400 });
    }
    return new NextResponse('Internal server error', { status: 500 });
  }
}