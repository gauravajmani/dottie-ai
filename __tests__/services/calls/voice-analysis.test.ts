import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { VoiceAnalysisService, VoiceAnalysis } from '@/lib/services/calls/voice-analysis';
import { OpenAI } from 'openai';
import { Deepgram } from '@deepgram/sdk';
import { Assemblyai } from 'assemblyai';
import { S3 } from 'aws-sdk';

// Mock external dependencies
jest.mock('openai');
jest.mock('@deepgram/sdk');
jest.mock('assemblyai');
jest.mock('aws-sdk');

describe('VoiceAnalysisService', () => {
  let service: VoiceAnalysisService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockDeepgram: jest.Mocked<Deepgram>;
  let mockAssemblyai: jest.Mocked<Assemblyai>;
  let mockS3: jest.Mocked<S3>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as unknown as jest.Mocked<OpenAI>;

    mockDeepgram = {
      transcription: {
        preRecorded: jest.fn()
      }
    } as unknown as jest.Mocked<Deepgram>;

    mockAssemblyai = {
      transcribe: jest.fn()
    } as unknown as jest.Mocked<Assemblyai>;

    mockS3 = {
      getObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Body: Buffer.from('test audio') })
      })
    } as unknown as jest.Mocked<S3>;

    // Inject mocks
    (OpenAI as jest.Mock).mockImplementation(() => mockOpenAI);
    (Deepgram as jest.Mock).mockImplementation(() => mockDeepgram);
    (Assemblyai as jest.Mock).mockImplementation(() => mockAssemblyai);
    (S3 as jest.Mock).mockImplementation(() => mockS3);

    service = new VoiceAnalysisService();
  });

  describe('analyzeVoice', () => {
    const mockAudioUrl = 'https://example.com/audio.mp3';
    const mockS3Url = 's3://bucket/audio.mp3';

    it('should successfully analyze voice from HTTP URL', async () => {
      // Mock fetch for HTTP URL
      global.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
      });

      // Mock Deepgram response
      mockDeepgram.transcription.preRecorded.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{
              audio_features: {
                pitch_mean: 220,
                energy_mean: 0.8,
                clarity_mean: 0.9,
                tempo_mean: 120,
                pitch_variability: 0.3
              },
              confidence: 0.95,
              words: [
                { word: 'hello' },
                { word: 'world' }
              ]
            }],
            snr: 20,
            clarity: 0.85,
            background_noise: 0.1
          }]
        }
      });

      // Mock AssemblyAI response
      mockAssemblyai.transcribe.mockResolvedValue({
        sentiment_analysis_results: [
          { sentiment: 'positive' },
          { sentiment: 'neutral' },
          { sentiment: 'positive' }
        ]
      });

      const result = await service.analyzeVoice(mockAudioUrl);

      expect(result).toMatchObject({
        pitch: 220,
        energy: 0.8,
        clarity: 0.9,
        tempo: 120,
        variability: 0.3,
        emotion: 'positive',
        emotionFlow: ['positive', 'neutral', 'positive'],
        confidence: 0.95,
        audioQuality: {
          snr: 20,
          clarity: 0.85,
          background_noise: 0.1
        }
      });
    });

    it('should successfully analyze voice from S3 URL', async () => {
      mockDeepgram.transcription.preRecorded.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{
              audio_features: {
                pitch_mean: 220,
                energy_mean: 0.8,
                clarity_mean: 0.9,
                tempo_mean: 120,
                pitch_variability: 0.3
              }
            }]
          }]
        }
      });

      mockAssemblyai.transcribe.mockResolvedValue({
        sentiment_analysis_results: [
          { sentiment: 'positive' }
        ]
      });

      const result = await service.analyzeVoice(mockS3Url);

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'bucket',
        Key: 'audio.mp3'
      });
      expect(result).toBeDefined();
    });

    it('should handle missing audio features gracefully', async () => {
      mockDeepgram.transcription.preRecorded.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{}]
          }]
        }
      });

      mockAssemblyai.transcribe.mockResolvedValue({
        sentiment_analysis_results: []
      });

      const result = await service.analyzeVoice(mockAudioUrl);

      expect(result).toMatchObject({
        pitch: 0,
        energy: 0,
        clarity: 0,
        tempo: 0,
        variability: 0
      });
    });

    it('should handle API errors gracefully', async () => {
      mockDeepgram.transcription.preRecorded.mockRejectedValue(
        new Error('API Error')
      );

      await expect(service.analyzeVoice(mockAudioUrl))
        .rejects
        .toThrow('Failed to analyze voice recording');
    });
  });

  describe('generateInsights', () => {
    const mockAnalysis: VoiceAnalysis = {
      pitch: 220,
      energy: 0.8,
      clarity: 0.9,
      tempo: 120,
      variability: 0.3,
      emotion: 'positive',
      emotionFlow: ['neutral', 'positive', 'excited'],
      keywords: [
        { word: 'project', frequency: 5 },
        { word: 'success', frequency: 3 }
      ],
      confidence: 0.95,
      audioQuality: {
        snr: 20,
        clarity: 0.85,
        background_noise: 0.1
      }
    };

    it('should generate insights successfully', async () => {
      const mockInsights = 'Voice analysis insights...';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockInsights } }]
      } as any);

      const insights = await service.generateInsights(mockAnalysis);

      expect(insights).toBe(mockInsights);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.any(String)
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Analyze the following voice metrics')
            })
          ])
        })
      );
    });

    it('should handle empty OpenAI response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }]
      } as any);

      const insights = await service.generateInsights(mockAnalysis);

      expect(insights).toBe('');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API Error')
      );

      await expect(service.generateInsights(mockAnalysis))
        .rejects
        .toThrow('OpenAI API Error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty audio buffer', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0))
      });

      mockDeepgram.transcription.preRecorded.mockResolvedValue({
        results: { channels: [] }
      });

      const result = await service.analyzeVoice('https://example.com/empty.mp3');

      expect(result).toMatchObject({
        pitch: 0,
        energy: 0,
        clarity: 0,
        tempo: 0,
        variability: 0
      });
    });

    it('should handle malformed URLs', async () => {
      await expect(service.analyzeVoice('invalid-url'))
        .rejects
        .toThrow();
    });

    it('should handle extremely long emotion flows', async () => {
      mockAssemblyai.transcribe.mockResolvedValue({
        sentiment_analysis_results: Array(1000).fill({ sentiment: 'neutral' })
      });

      mockDeepgram.transcription.preRecorded.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{ audio_features: {} }]
          }]
        }
      });

      const result = await service.analyzeVoice('https://example.com/long.mp3');
      expect(result.emotionFlow.length).toBeLessThan(1000);
    });
  });
});