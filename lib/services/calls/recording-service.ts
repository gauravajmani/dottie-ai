import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export interface RecordingMetadata {
  duration: number;
  format: string;
  size: number;
  bitrate: number;
  channels: number;
  sampleRate: number;
}

export interface RecordingTranscript {
  text: string;
  segments: {
    start: number;
    end: number;
    speaker: string;
    text: string;
    confidence: number;
  }[];
}

export class RecordingService {
  private s3: S3Client;
  private bucket: string;
  private expirationTime: number;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.AWS_S3_BUCKET!;
    this.expirationTime = 3600; // 1 hour
  }

  async saveRecording(
    callId: string,
    recordingUrl: string,
    metadata: RecordingMetadata
  ): Promise<void> {
    try {
      // Download recording from provider URL
      const response = await fetch(recordingUrl);
      const buffer = await response.arrayBuffer();

      // Generate a unique key for S3
      const key = this.generateRecordingKey(callId);

      // Upload to S3
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: Buffer.from(buffer),
          ContentType: 'audio/wav', // Adjust based on actual format
          Metadata: {
            callId,
            ...metadata,
          },
        })
      );

      // Save metadata to database
      await prisma.callRecording.create({
        data: {
          callId,
          s3Key: key,
          duration: metadata.duration,
          format: metadata.format,
          size: metadata.size,
          bitrate: metadata.bitrate,
          channels: metadata.channels,
          sampleRate: metadata.sampleRate,
        },
      });
    } catch (error) {
      console.error('Error saving recording:', error);
      throw error;
    }
  }

  async getRecordingUrl(callId: string): Promise<string> {
    try {
      // Get S3 key from database
      const recording = await prisma.callRecording.findUnique({
        where: { callId },
      });

      if (!recording) {
        throw new Error('Recording not found');
      }

      // Generate presigned URL
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: recording.s3Key,
      });

      return getSignedUrl(this.s3, command, {
        expiresIn: this.expirationTime,
      });
    } catch (error) {
      console.error('Error getting recording URL:', error);
      throw error;
    }
  }

  async deleteRecording(callId: string): Promise<void> {
    try {
      // Get S3 key from database
      const recording = await prisma.callRecording.findUnique({
        where: { callId },
      });

      if (!recording) {
        throw new Error('Recording not found');
      }

      // Delete from S3
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: recording.s3Key,
        })
      );

      // Delete from database
      await prisma.callRecording.delete({
        where: { callId },
      });
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  }

  async saveTranscript(
    callId: string,
    transcript: RecordingTranscript
  ): Promise<void> {
    try {
      await prisma.callTranscript.create({
        data: {
          callId,
          text: transcript.text,
          segments: transcript.segments,
        },
      });
    } catch (error) {
      console.error('Error saving transcript:', error);
      throw error;
    }
  }

  async getTranscript(callId: string): Promise<RecordingTranscript | null> {
    try {
      const transcript = await prisma.callTranscript.findUnique({
        where: { callId },
      });

      return transcript;
    } catch (error) {
      console.error('Error getting transcript:', error);
      throw error;
    }
  }

  async listRecordings(options?: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    return prisma.callRecording.findMany({
      where: {
        call: {
          userId: options?.userId,
          createdAt: {
            gte: options?.startDate,
            lte: options?.endDate,
          },
        },
      },
      include: {
        call: true,
        transcript: true,
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  private generateRecordingKey(callId: string): string {
    const hash = createHash('sha256')
      .update(callId + Date.now().toString())
      .digest('hex');
    return \`recordings/\${callId}/\${hash}.wav\`;
  }

  async processRecording(
    callId: string,
    options: {
      trim?: { start: number; end: number };
      normalize?: boolean;
      removeNoise?: boolean;
      format?: string;
    }
  ): Promise<string> {
    try {
      // Get original recording URL
      const url = await this.getRecordingUrl(callId);

      // Process the audio file (implement audio processing logic)
      const processedUrl = await this.processAudio(url, options);

      return processedUrl;
    } catch (error) {
      console.error('Error processing recording:', error);
      throw error;
    }
  }

  private async processAudio(
    url: string,
    options: {
      trim?: { start: number; end: number };
      normalize?: boolean;
      removeNoise?: boolean;
      format?: string;
    }
  ): Promise<string> {
    // Implement audio processing logic here
    // This could involve using FFmpeg or other audio processing libraries
    return url; // Placeholder
  }

  async analyzeRecording(callId: string): Promise<{
    quality: number;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      // Get recording metadata
      const recording = await prisma.callRecording.findUnique({
        where: { callId },
        include: { transcript: true },
      });

      if (!recording) {
        throw new Error('Recording not found');
      }

      // Analyze recording quality and issues
      const analysis = {
        quality: this.calculateQualityScore(recording),
        issues: this.identifyQualityIssues(recording),
        recommendations: this.generateRecommendations(recording),
      };

      // Save analysis results
      await prisma.callRecording.update({
        where: { callId },
        data: {
          qualityScore: analysis.quality,
          qualityIssues: analysis.issues,
        },
      });

      return analysis;
    } catch (error) {
      console.error('Error analyzing recording:', error);
      throw error;
    }
  }

  private calculateQualityScore(recording: any): number {
    // Implement quality scoring logic based on:
    // - Bitrate
    // - Sample rate
    // - Background noise
    // - Clarity
    // - etc.
    return 0.85; // Placeholder
  }

  private identifyQualityIssues(recording: any): string[] {
    // Implement issue identification logic
    return []; // Placeholder
  }

  private generateRecommendations(recording: any): string[] {
    // Implement recommendation generation logic
    return []; // Placeholder
  }
}