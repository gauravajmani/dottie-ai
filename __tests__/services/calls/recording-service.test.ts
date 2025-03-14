import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingService } from '@/lib/services/calls/recording-service';
import { S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';

vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    callRecording: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    callTranscript: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('RecordingService', () => {
  let service: RecordingService;
  const mockMetadata = {
    duration: 300,
    format: 'wav',
    size: 1024000,
    bitrate: 128000,
    channels: 2,
    sampleRate: 44100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecordingService();
  });

  describe('saveRecording', () => {
    it('should save a recording to S3 and database', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      await service.saveRecording(
        'call-123',
        'https://example.com/recording.wav',
        mockMetadata
      );

      expect(S3Client.prototype.send).toHaveBeenCalled();
      expect(prisma.callRecording.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callId: 'call-123',
          duration: mockMetadata.duration,
        }),
      });
    });

    it('should handle errors when saving recording', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        service.saveRecording(
          'call-123',
          'https://example.com/recording.wav',
          mockMetadata
        )
      ).rejects.toThrow();
    });
  });

  describe('getRecordingUrl', () => {
    it('should return a signed URL for the recording', async () => {
      (prisma.callRecording.findUnique as any).mockResolvedValue({
        s3Key: 'recordings/call-123/recording.wav',
      });

      const url = await service.getRecordingUrl('call-123');

      expect(url).toBe('https://signed-url.example.com');
      expect(prisma.callRecording.findUnique).toHaveBeenCalledWith({
        where: { callId: 'call-123' },
      });
    });

    it('should throw error if recording not found', async () => {
      (prisma.callRecording.findUnique as any).mockResolvedValue(null);

      await expect(service.getRecordingUrl('call-123')).rejects.toThrow(
        'Recording not found'
      );
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording from S3 and database', async () => {
      (prisma.callRecording.findUnique as any).mockResolvedValue({
        s3Key: 'recordings/call-123/recording.wav',
      });

      await service.deleteRecording('call-123');

      expect(S3Client.prototype.send).toHaveBeenCalled();
      expect(prisma.callRecording.delete).toHaveBeenCalledWith({
        where: { callId: 'call-123' },
      });
    });
  });

  describe('saveTranscript', () => {
    it('should save transcript to database', async () => {
      const transcript = {
        text: 'Full transcription',
        segments: [
          {
            start: 0,
            end: 5,
            speaker: 'agent',
            text: 'Hello',
            confidence: 0.95,
          },
        ],
      };

      await service.saveTranscript('call-123', transcript);

      expect(prisma.callTranscript.create).toHaveBeenCalledWith({
        data: {
          callId: 'call-123',
          text: transcript.text,
          segments: transcript.segments,
        },
      });
    });
  });

  describe('getTranscript', () => {
    it('should retrieve transcript from database', async () => {
      const mockTranscript = {
        text: 'Full transcription',
        segments: [],
      };

      (prisma.callTranscript.findUnique as any).mockResolvedValue(mockTranscript);

      const transcript = await service.getTranscript('call-123');

      expect(transcript).toEqual(mockTranscript);
      expect(prisma.callTranscript.findUnique).toHaveBeenCalledWith({
        where: { callId: 'call-123' },
      });
    });
  });

  describe('listRecordings', () => {
    it('should list recordings with filters', async () => {
      const mockRecordings = [
        {
          callId: 'call-123',
          duration: 300,
          createdAt: new Date(),
        },
      ];

      (prisma.callRecording.findMany as any).mockResolvedValue(mockRecordings);

      const recordings = await service.listRecordings({
        userId: 'user-123',
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(recordings).toEqual(mockRecordings);
      expect(prisma.callRecording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
          include: expect.any(Object),
        })
      );
    });
  });

  describe('processRecording', () => {
    it('should process recording with options', async () => {
      const url = await service.processRecording('call-123', {
        trim: { start: 0, end: 10 },
        normalize: true,
        removeNoise: true,
        format: 'mp3',
      });

      expect(url).toBeDefined();
    });
  });

  describe('analyzeRecording', () => {
    it('should analyze recording quality', async () => {
      (prisma.callRecording.findUnique as any).mockResolvedValue({
        duration: 300,
        bitrate: 128000,
        sampleRate: 44100,
      });

      const analysis = await service.analyzeRecording('call-123');

      expect(analysis.quality).toBeDefined();
      expect(analysis.issues).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(prisma.callRecording.update).toHaveBeenCalled();
    });
  });
});