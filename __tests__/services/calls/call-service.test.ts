import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallService } from '@/lib/services/calls/call-service';
import { TwilioCallProvider } from '@/lib/services/calls/twilio-provider';
import { VAPICallProvider } from '@/lib/services/calls/vapi-provider';

vi.mock('@/lib/services/calls/twilio-provider');
vi.mock('@/lib/services/calls/vapi-provider');

describe('CallService', () => {
  const userId = 'test-user';
  let callService: CallService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with Twilio provider', () => {
    beforeEach(() => {
      callService = new CallService(userId, 'twilio');
    });

    it('should make a call using Twilio provider', async () => {
      const options = {
        to: '+1234567890',
        from: '+0987654321',
        recordingEnabled: true,
        transcriptionEnabled: true,
      };

      const mockCallId = 'twilio-call-id';
      (TwilioCallProvider.prototype.makeCall as any).mockResolvedValue(mockCallId);

      const result = await callService.makeCall(options);

      expect(result).toBe(mockCallId);
      expect(TwilioCallProvider.prototype.makeCall).toHaveBeenCalledWith(options);
    });

    it('should handle incoming calls', async () => {
      const callId = 'call-id';
      const from = '+1234567890';
      const mockResponse = '<Response><Say>Hello</Say></Response>';

      (TwilioCallProvider.prototype.handleIncomingCall as any).mockResolvedValue(mockResponse);

      const result = await callService.handleIncomingCall(callId, from);

      expect(result).toBe(mockResponse);
      expect(TwilioCallProvider.prototype.handleIncomingCall).toHaveBeenCalledWith(callId, from);
    });

    it('should update call status', async () => {
      const callId = 'call-id';
      const status = 'completed';

      await callService.updateCallStatus(callId, status);

      expect(TwilioCallProvider.prototype.updateCallStatus).toHaveBeenCalledWith(callId, status);
    });
  });

  describe('with VAPI provider', () => {
    beforeEach(() => {
      callService = new CallService(userId, 'vapi');
    });

    it('should make a call using VAPI provider', async () => {
      const options = {
        to: '+1234567890',
        from: '+0987654321',
        recordingEnabled: true,
        transcriptionEnabled: true,
      };

      const mockCallId = 'vapi-call-id';
      (VAPICallProvider.prototype.makeCall as any).mockResolvedValue(mockCallId);

      const result = await callService.makeCall(options);

      expect(result).toBe(mockCallId);
      expect(VAPICallProvider.prototype.makeCall).toHaveBeenCalledWith(options);
    });

    it('should handle incoming calls', async () => {
      const callId = 'call-id';
      const from = '+1234567890';
      const mockResponse = { message: 'Hello', voice: 'jennifer' };

      (VAPICallProvider.prototype.handleIncomingCall as any).mockResolvedValue(mockResponse);

      const result = await callService.handleIncomingCall(callId, from);

      expect(result).toEqual(mockResponse);
      expect(VAPICallProvider.prototype.handleIncomingCall).toHaveBeenCalledWith(callId, from);
    });

    it('should update call status', async () => {
      const callId = 'call-id';
      const status = 'completed';

      await callService.updateCallStatus(callId, status);

      expect(VAPICallProvider.prototype.updateCallStatus).toHaveBeenCalledWith(callId, status);
    });

    it('should get call analytics', async () => {
      const callId = 'call-id';
      const mockAnalytics = { duration: 60, sentiment: 'positive' };

      (VAPICallProvider.prototype.getCallAnalytics as any).mockResolvedValue(mockAnalytics);

      const result = await callService.getVAPICallAnalytics(callId);

      expect(result).toEqual(mockAnalytics);
      expect(VAPICallProvider.prototype.getCallAnalytics).toHaveBeenCalledWith(callId);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      callService = new CallService(userId);
    });

    it('should handle provider errors when making calls', async () => {
      const options = {
        to: '+1234567890',
        from: '+0987654321',
      };

      const error = new Error('Provider error');
      (TwilioCallProvider.prototype.makeCall as any).mockRejectedValue(error);

      await expect(callService.makeCall(options)).rejects.toThrow('Provider error');
    });

    it('should handle invalid provider selection', () => {
      expect(() => new CallService(userId, 'invalid' as any)).toThrow('Invalid provider');
    });
  });
});