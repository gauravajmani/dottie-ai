import { OpenAI } from 'openai';
import { Deepgram } from '@deepgram/sdk';
import { Assemblyai } from 'assemblyai';
import { S3 } from 'aws-sdk';

export interface VoiceAnalysis {
  pitch: number;
  energy: number;
  clarity: number;
  tempo: number;
  variability: number;
  emotion: string;
  emotionFlow: string[];
  keywords: Array<{ word: string; frequency: number }>;
  confidence: number;
  audioQuality: {
    snr: number;
    clarity: number;
    background_noise: number;
  };
}

export interface EmotionSegment {
  start: number;
  end: number;
  emotion: string;
  confidence: number;
}

export class VoiceAnalysisService {
  private openai: OpenAI;
  private deepgram: Deepgram;
  private assemblyai: Assemblyai;
  private s3: S3;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY!);

    this.assemblyai = new Assemblyai({
      apiKey: process.env.ASSEMBLYAI_API_KEY,
    });

    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  async analyzeVoice(audioUrl: string): Promise<VoiceAnalysis> {
    try {
      // Download audio from S3 if needed
      const audioBuffer = await this.getAudioBuffer(audioUrl);

      // Parallel processing for different aspects
      const [
        acousticFeatures,
        emotionAnalysis,
        transcriptionAnalysis
      ] = await Promise.all([
        this.analyzeAcousticFeatures(audioBuffer),
        this.analyzeEmotions(audioBuffer),
        this.analyzeTranscription(audioBuffer)
      ]);

      // Combine all analyses
      return {
        ...acousticFeatures,
        emotion: emotionAnalysis.currentEmotion,
        emotionFlow: emotionAnalysis.emotionFlow,
        keywords: transcriptionAnalysis.keywords,
        confidence: transcriptionAnalysis.confidence,
        audioQuality: transcriptionAnalysis.audioQuality
      };
    } catch (error) {
      console.error('Error in voice analysis:', error);
      throw new Error('Failed to analyze voice recording');
    }
  }

  private async getAudioBuffer(audioUrl: string): Promise<Buffer> {
    if (audioUrl.startsWith('s3://')) {
      const [bucket, ...key] = audioUrl.replace('s3://', '').split('/');
      const response = await this.s3.getObject({
        Bucket: bucket,
        Key: key.join('/')
      }).promise();
      return response.Body as Buffer;
    } else {
      const response = await fetch(audioUrl);
      return Buffer.from(await response.arrayBuffer());
    }
  }

  private async analyzeAcousticFeatures(audioBuffer: Buffer) {
    const response = await this.deepgram.transcription.preRecorded(
      { buffer: audioBuffer },
      {
        smart_format: true,
        numerals: true,
        model: 'nova-2',
        diarize: true,
        utterances: true,
        punctuate: true,
        detect_topics: true,
        detect_language: true,
        audio_features: true
      }
    );

    const features = response.results?.channels[0]?.alternatives[0]?.audio_features || {};
    
    return {
      pitch: features.pitch_mean || 0,
      energy: features.energy_mean || 0,
      clarity: features.clarity_mean || 0,
      tempo: features.tempo_mean || 0,
      variability: features.pitch_variability || 0
    };
  }

  private async analyzeEmotions(audioBuffer: Buffer): Promise<{
    currentEmotion: string;
    emotionFlow: string[];
  }> {
    const transcript = await this.assemblyai.transcribe({
      audio: audioBuffer,
      sentiment_analysis: true,
      entity_detection: true,
      auto_chapters: true
    });

    // Process emotion segments
    const emotionSegments = transcript.sentiment_analysis_results || [];
    const emotions = emotionSegments.map(segment => segment.sentiment);
    
    return {
      currentEmotion: this.getMostFrequentEmotion(emotions),
      emotionFlow: this.simplifyEmotionFlow(emotions)
    };
  }

  private async analyzeTranscription(audioBuffer: Buffer) {
    const transcription = await this.deepgram.transcription.preRecorded(
      { buffer: audioBuffer },
      {
        smart_format: true,
        model: 'nova-2',
        detect_topics: true,
        summarize: true,
        detect_entities: true
      }
    );

    const words = transcription.results?.channels[0]?.alternatives[0]?.words || [];
    const keywords = this.extractKeywords(words);

    return {
      keywords,
      confidence: transcription.results?.channels[0]?.alternatives[0]?.confidence || 0,
      audioQuality: {
        snr: transcription.results?.channels[0]?.snr || 0,
        clarity: transcription.results?.channels[0]?.clarity || 0,
        background_noise: transcription.results?.channels[0]?.background_noise || 0
      }
    };
  }

  private getMostFrequentEmotion(emotions: string[]): string {
    const counts = emotions.reduce((acc, emotion) => {
      acc[emotion] = (acc[emotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  private simplifyEmotionFlow(emotions: string[]): string[] {
    // Remove consecutive duplicates
    return emotions.filter((emotion, index, array) => 
      emotion !== array[index - 1]
    );
  }

  private extractKeywords(words: any[]): Array<{ word: string; frequency: number }> {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const wordCounts: Record<string, number> = {};

    words.forEach(word => {
      const text = word.word.toLowerCase();
      if (!stopWords.has(text) && text.length > 2) {
        wordCounts[text] = (wordCounts[text] || 0) + 1;
      }
    });

    return Object.entries(wordCounts)
      .map(([word, frequency]) => ({ word, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20); // Return top 20 keywords
  }

  async generateInsights(analysis: VoiceAnalysis): Promise<string> {
    const prompt = `Analyze the following voice metrics and provide insights:
      - Pitch: ${analysis.pitch}
      - Energy: ${analysis.energy}
      - Clarity: ${analysis.clarity}
      - Emotion Flow: ${analysis.emotionFlow.join(' → ')}
      - Top Keywords: ${analysis.keywords.slice(0, 5).map(k => k.word).join(', ')}
      
      Please provide:
      1. Overall tone and engagement level
      2. Key emotional transitions and their significance
      3. Areas for improvement
      4. Notable patterns or trends`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert in voice analysis and communication coaching."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content || '';
  }
}