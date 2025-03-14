import { OpenAI } from 'openai';
import { CallAnalytics } from './types';

export interface AIInsight {
  type: 'improvement' | 'success' | 'trend' | 'anomaly';
  title: string;
  description: string;
  confidence: number;
  metrics: string[];
  recommendations?: string[];
}

export interface CallInsights {
  insights: AIInsight[];
  summary: string;
  keyTakeaways: string[];
  actionItems: string[];
}

export class AIInsightsService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateCallInsights(
    callAnalytics: CallAnalytics,
    transcription: string
  ): Promise<CallInsights> {
    try {
      const prompt = this.buildInsightsPrompt(callAnalytics, transcription);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert call analyzer that provides detailed insights and actionable recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return this.parseAIResponse(response.choices[0].message.content || '');
    } catch (error) {
      console.error('Error generating AI insights:', error);
      throw error;
    }
  }

  async analyzeTrends(analytics: CallAnalytics[]): Promise<AIInsight[]> {
    try {
      const prompt = this.buildTrendsPrompt(analytics);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing call trends and patterns.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return this.parseTrendsResponse(response.choices[0].message.content || '');
    } catch (error) {
      console.error('Error analyzing trends:', error);
      throw error;
    }
  }

  async generateCustomerProfile(
    customerCalls: { analytics: CallAnalytics; transcription: string }[]
  ): Promise<{
    preferences: Record<string, number>;
    topics: string[];
    sentiment: Record<string, number>;
    communicationStyle: string;
    recommendations: string[];
  }> {
    try {
      const prompt = this.buildCustomerProfilePrompt(customerCalls);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing customer behavior and communication patterns.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return this.parseCustomerProfileResponse(response.choices[0].message.content || '');
    } catch (error) {
      console.error('Error generating customer profile:', error);
      throw error;
    }
  }

  private buildInsightsPrompt(
    analytics: CallAnalytics,
    transcription: string
  ): string {
    return `
      Please analyze this call and provide detailed insights.
      
      Call Analytics:
      - Duration: ${analytics.duration} seconds
      - Sentiment: ${JSON.stringify(analytics.sentiment)}
      - Topics: ${analytics.topics?.join(', ')}
      - Speaker Ratio: ${JSON.stringify(analytics.speakerRatio)}
      - Interruptions: ${analytics.interruptions}
      - Pace: ${JSON.stringify(analytics.pace)}
      
      Transcription:
      ${transcription}
      
      Please provide:
      1. Key insights about the call
      2. Areas for improvement
      3. What went well
      4. Action items
      5. Specific recommendations
    `;
  }

  private buildTrendsPrompt(analytics: CallAnalytics[]): string {
    return `
      Please analyze these calls for trends and patterns.
      
      Call Analytics:
      ${analytics.map(a => JSON.stringify(a)).join('\n')}
      
      Please identify:
      1. Significant trends
      2. Anomalies or outliers
      3. Patterns in sentiment, duration, and topics
      4. Areas for improvement
      5. Success patterns to replicate
    `;
  }

  private buildCustomerProfilePrompt(
    calls: { analytics: CallAnalytics; transcription: string }[]
  ): string {
    return `
      Please analyze these customer interactions and create a detailed profile.
      
      Calls:
      ${calls.map(call => `
        Analytics: ${JSON.stringify(call.analytics)}
        Transcription: ${call.transcription}
      `).join('\n')}
      
      Please provide:
      1. Customer preferences and priorities
      2. Common topics and concerns
      3. Sentiment patterns
      4. Communication style
      5. Recommendations for future interactions
    `;
  }

  private parseAIResponse(response: string): CallInsights {
    // Implement parsing logic based on the AI response format
    const sections = response.split('\n\n');
    
    return {
      insights: this.extractInsights(sections),
      summary: this.extractSummary(sections),
      keyTakeaways: this.extractKeyTakeaways(sections),
      actionItems: this.extractActionItems(sections),
    };
  }

  private parseTrendsResponse(response: string): AIInsight[] {
    // Implement parsing logic for trends response
    const sections = response.split('\n\n');
    return this.extractInsights(sections);
  }

  private parseCustomerProfileResponse(response: string): any {
    // Implement parsing logic for customer profile response
    const sections = response.split('\n\n');
    
    return {
      preferences: this.extractPreferences(sections),
      topics: this.extractTopics(sections),
      sentiment: this.extractSentimentPatterns(sections),
      communicationStyle: this.extractCommunicationStyle(sections),
      recommendations: this.extractRecommendations(sections),
    };
  }

  private extractInsights(sections: string[]): AIInsight[] {
    // Implementation of insight extraction
    return sections
      .filter(section => section.includes('Insight:'))
      .map(section => {
        const [title, ...rest] = section.split('\n');
        return {
          type: this.determineInsightType(title),
          title: title.replace('Insight:', '').trim(),
          description: rest.join('\n').trim(),
          confidence: this.calculateConfidence(section),
          metrics: this.extractMetrics(section),
          recommendations: this.extractRecommendations([section]),
        };
      });
  }

  private determineInsightType(title: string): AIInsight['type'] {
    if (title.toLowerCase().includes('improve')) return 'improvement';
    if (title.toLowerCase().includes('success')) return 'success';
    if (title.toLowerCase().includes('trend')) return 'trend';
    return 'anomaly';
  }

  private calculateConfidence(text: string): number {
    // Implement confidence calculation based on AI response certainty indicators
    return 0.85; // Placeholder
  }

  private extractMetrics(text: string): string[] {
    // Implement metric extraction
    return [];
  }

  private extractSummary(sections: string[]): string {
    return sections.find(s => s.includes('Summary:'))?.replace('Summary:', '').trim() || '';
  }

  private extractKeyTakeaways(sections: string[]): string[] {
    const takeaways = sections.find(s => s.includes('Key Takeaways:'));
    return takeaways
      ? takeaways
          .replace('Key Takeaways:', '')
          .split('\n')
          .map(t => t.trim())
          .filter(Boolean)
      : [];
  }

  private extractActionItems(sections: string[]): string[] {
    const actions = sections.find(s => s.includes('Action Items:'));
    return actions
      ? actions
          .replace('Action Items:', '')
          .split('\n')
          .map(a => a.trim())
          .filter(Boolean)
      : [];
  }

  private extractPreferences(sections: string[]): Record<string, number> {
    // Implement preference extraction
    return {};
  }

  private extractTopics(sections: string[]): string[] {
    // Implement topic extraction
    return [];
  }

  private extractSentimentPatterns(sections: string[]): Record<string, number> {
    // Implement sentiment pattern extraction
    return {};
  }

  private extractCommunicationStyle(sections: string[]): string {
    // Implement communication style extraction
    return '';
  }

  private extractRecommendations(sections: string[]): string[] {
    const recs = sections.find(s => s.includes('Recommendations:'));
    return recs
      ? recs
          .replace('Recommendations:', '')
          .split('\n')
          .map(r => r.trim())
          .filter(Boolean)
      : [];
  }
}