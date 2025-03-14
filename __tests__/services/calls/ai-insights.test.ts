import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIInsightsService } from '@/lib/services/calls/ai-insights';
import { CallAnalytics } from '@/lib/services/calls/types';

vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: `
                  Summary: Test call summary

                  Insight: Improvement Needed
                  Customer service response time was slow
                  Metrics: response_time, customer_satisfaction
                  Recommendations:
                  - Improve initial response time
                  - Use pre-written templates for common issues

                  Insight: Success Pattern
                  Excellent problem resolution approach
                  Metrics: resolution_rate, customer_satisfaction
                  
                  Key Takeaways:
                  - Response time needs improvement
                  - Problem resolution was effective
                  - Customer was satisfied with solution
                  
                  Action Items:
                  - Implement response time monitoring
                  - Share successful resolution approach with team
                  - Update service templates
                `,
              },
            },
          ],
        }),
      },
    },
  })),
}));

describe('AIInsightsService', () => {
  let service: AIInsightsService;
  const mockAnalytics: CallAnalytics = {
    duration: 300,
    sentiment: {
      overall: 'positive',
      score: 0.8,
      breakdown: {
        positive: 0.8,
        neutral: 0.15,
        negative: 0.05,
      },
    },
    topics: ['billing', 'support'],
    speakerRatio: {
      agent: 0.4,
      customer: 0.6,
    },
    interruptions: 2,
    pace: {
      wordsPerMinute: 150,
      rating: 'normal',
    },
  };

  beforeEach(() => {
    service = new AIInsightsService();
  });

  describe('generateCallInsights', () => {
    it('should generate insights for a call', async () => {
      const transcription = 'Mock call transcription';
      const insights = await service.generateCallInsights(mockAnalytics, transcription);

      expect(insights).toBeDefined();
      expect(insights.summary).toBeDefined();
      expect(insights.insights.length).toBeGreaterThan(0);
      expect(insights.keyTakeaways.length).toBeGreaterThan(0);
      expect(insights.actionItems.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const openai = await import('openai');
      (openai.OpenAI as any).mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      }));

      await expect(
        service.generateCallInsights(mockAnalytics, 'transcription')
      ).rejects.toThrow();
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze trends across multiple calls', async () => {
      const analytics = [mockAnalytics, mockAnalytics];
      const trends = await service.analyzeTrends(analytics);

      expect(trends).toBeDefined();
      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBeGreaterThan(0);
    });
  });

  describe('generateCustomerProfile', () => {
    it('should generate a customer profile from call history', async () => {
      const calls = [
        { analytics: mockAnalytics, transcription: 'Call 1' },
        { analytics: mockAnalytics, transcription: 'Call 2' },
      ];

      const profile = await service.generateCustomerProfile(calls);

      expect(profile).toBeDefined();
      expect(profile.preferences).toBeDefined();
      expect(profile.topics).toBeDefined();
      expect(profile.sentiment).toBeDefined();
      expect(profile.communicationStyle).toBeDefined();
      expect(profile.recommendations).toBeDefined();
    });
  });
});