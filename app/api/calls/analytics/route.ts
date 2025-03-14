import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
} from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = new URL(req.url).searchParams;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();
    const view = searchParams.get('view') || 'daily';

    const calls = await prisma.call.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        analytics: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const timeRanges = getTimeRanges(startDate, endDate, view);
    const aggregatedData = aggregateCallData(calls, timeRanges, view);

    return NextResponse.json({
      calls: aggregatedData,
      summary: calculateSummary(calls),
    });
  } catch (error) {
    console.error('Error fetching call analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getTimeRanges(startDate: Date, endDate: Date, view: string) {
  switch (view) {
    case 'daily':
      return eachDayOfInterval({ start: startDate, end: endDate }).map(date => ({
        start: startOfDay(date),
        end: endOfDay(date),
        label: format(date, 'MMM d'),
      }));
    case 'weekly':
      return eachWeekOfInterval({ start: startDate, end: endDate }).map(date => ({
        start: startOfWeek(date),
        end: endOfWeek(date),
        label: \`Week of \${format(date, 'MMM d')}\`,
      }));
    case 'monthly':
      return eachMonthOfInterval({ start: startDate, end: endDate }).map(date => ({
        start: startOfMonth(date),
        end: endOfMonth(date),
        label: format(date, 'MMM yyyy'),
      }));
    default:
      return [];
  }
}

function aggregateCallData(calls: any[], timeRanges: any[], view: string) {
  return timeRanges.map(range => {
    const periodCalls = calls.filter(call =>
      call.createdAt >= range.start && call.createdAt <= range.end
    );

    return {
      period: range.label,
      totalCalls: periodCalls.length,
      averageDuration: calculateAverageDuration(periodCalls),
      averageSentiment: calculateAverageSentiment(periodCalls),
      topTopics: findTopTopics(periodCalls),
      speakerRatio: calculateSpeakerRatio(periodCalls),
      paceDistribution: calculatePaceDistribution(periodCalls),
    };
  });
}

function calculateAverageDuration(calls: any[]) {
  if (!calls.length) return 0;
  return calls.reduce((sum, call) => sum + (call.duration || 0), 0) / calls.length;
}

function calculateAverageSentiment(calls: any[]) {
  const callsWithSentiment = calls.filter(call => 
    call.analytics?.sentiment?.score !== undefined
  );
  if (!callsWithSentiment.length) return 0;
  
  return callsWithSentiment.reduce((sum, call) => 
    sum + call.analytics.sentiment.score, 0) / callsWithSentiment.length;
}

function findTopTopics(calls: any[]) {
  const topicsCount: Record<string, number> = {};
  calls.forEach(call => {
    call.analytics?.topics?.forEach((topic: string) => {
      topicsCount[topic] = (topicsCount[topic] || 0) + 1;
    });
  });

  return Object.entries(topicsCount)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function calculateSpeakerRatio(calls: any[]) {
  const totalRatio = calls.reduce(
    (acc, call) => {
      if (call.analytics?.speakerRatio) {
        acc.agent += call.analytics.speakerRatio.agent;
        acc.customer += call.analytics.speakerRatio.customer;
      }
      return acc;
    },
    { agent: 0, customer: 0 }
  );

  const total = totalRatio.agent + totalRatio.customer;
  if (total === 0) return { agent: 50, customer: 50 };

  return {
    agent: Math.round((totalRatio.agent / total) * 100),
    customer: Math.round((totalRatio.customer / total) * 100),
  };
}

function calculatePaceDistribution(calls: any[]) {
  const distribution = calls.reduce(
    (acc, call) => {
      if (call.analytics?.pace?.rating) {
        acc[call.analytics.pace.rating]++;
      }
      return acc;
    },
    { slow: 0, normal: 0, fast: 0 }
  );

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return distribution;

  return Object.entries(distribution).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: Math.round((value / total) * 100),
    }),
    {} as Record<string, number>
  );
}

function calculateSummary(calls: any[]) {
  return {
    totalCalls: calls.length,
    averageDuration: calculateAverageDuration(calls),
    averageSentiment: calculateAverageSentiment(calls),
    topTopics: findTopTopics(calls),
    overallSpeakerRatio: calculateSpeakerRatio(calls),
    overallPaceDistribution: calculatePaceDistribution(calls),
  };
}