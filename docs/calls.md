# Call Service Documentation

## Overview

The call service provides a comprehensive solution for managing phone calls in your application. It supports multiple providers (Twilio and VAPI), call scheduling, conference calls, recording management, and AI-powered analytics.

## Features

### Basic Call Management

- Make outbound calls
- Handle incoming calls
- Record calls
- Transcribe calls
- Update call status
- List calls with filtering

```typescript
const callService = new CallService(userId);

// Make a call
const callId = await callService.makeCall({
  to: '+1234567890',
  from: '+0987654321',
  recordingEnabled: true,
  transcriptionEnabled: true,
});

// List calls
const calls = await callService.listCalls({
  status: 'completed',
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  limit: 50,
});
```

### Call Scheduling

Schedule calls for future dates with recurrence and reminders:

```typescript
const scheduledCallId = await callService.scheduleCall({
  to: '+1234567890',
  from: '+0987654321',
  scheduledTime: new Date('2024-03-20T10:00:00Z'),
  timezone: 'America/New_York',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
    endDate: new Date('2024-06-20'),
  },
  reminder: {
    enabled: true,
    minutesBefore: 15,
    method: 'both', // SMS and email
  },
});
```

### Conference Calls

Create and manage conference calls with multiple participants:

```typescript
// Create conference
const conferenceId = await callService.createConference({
  name: 'Team Meeting',
  participants: ['+1234567890', '+0987654321'],
  from: '+9876543210',
  moderator: '+1234567890',
  maxParticipants: 10,
  recordingEnabled: true,
  transcriptionEnabled: true,
  waitingRoom: true,
  muteOnEntry: true,
});

// Add participant
await callService.addParticipantToConference(conferenceId, '+5544332211');

// Mute participant
await callService.muteParticipant(conferenceId, participantId, true);

// End conference
await callService.endConference(conferenceId);
```

### Recording Management

Manage call recordings with advanced features:

```typescript
const recordingService = new RecordingService();

// Save recording
await recordingService.saveRecording(callId, recordingUrl, {
  duration: 300,
  format: 'wav',
  size: 1024000,
  bitrate: 128000,
  channels: 2,
  sampleRate: 44100,
});

// Get recording URL
const url = await recordingService.getRecordingUrl(callId);

// Process recording
const processedUrl = await recordingService.processRecording(callId, {
  trim: { start: 0, end: 10 },
  normalize: true,
  removeNoise: true,
  format: 'mp3',
});

// Analyze recording quality
const analysis = await recordingService.analyzeRecording(callId);
```

### AI-Powered Analytics

Get detailed insights from your calls:

```typescript
const aiService = new AIInsightsService();

// Generate insights for a single call
const insights = await aiService.generateCallInsights(
  callAnalytics,
  transcription
);

// Analyze trends across multiple calls
const trends = await aiService.analyzeTrends(analyticsArray);

// Generate customer profile
const profile = await aiService.generateCustomerProfile(customerCalls);
```

## Components

### CallManager Component

A React component for managing calls:

```tsx
import { CallManager } from '@/components/calls/CallManager';

export default function CallsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Call Management</h1>
      <CallManager />
    </div>
  );
}
```

### CallAnalyticsDashboard Component

A React component for visualizing call analytics:

```tsx
import { CallAnalyticsDashboard } from '@/components/calls/CallAnalyticsDashboard';

export default function AnalyticsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Call Analytics</h1>
      <CallAnalyticsDashboard />
    </div>
  );
}
```

## API Routes

### Call Management

- `POST /api/calls` - Make a new call
- `GET /api/calls` - List calls
- `POST /api/calls/schedule` - Schedule a call
- `POST /api/calls/conference` - Create a conference

### Webhooks

- `POST /api/calls/twilio/webhook` - Twilio webhook handler
- `POST /api/calls/vapi/webhook` - VAPI webhook handler

### Analytics

- `GET /api/calls/analytics` - Get call analytics

## Environment Variables

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number

# VAPI Configuration
VAPI_API_KEY=your_api_key
VAPI_BASE_URL=https://api.vapi.com
VAPI_DEFAULT_CALLBACK_URL=https://your-app.com/api/calls/vapi/webhook
VAPI_DEFAULT_VOICE=jennifer
VAPI_DEFAULT_LANGUAGE=en-US

# AWS Configuration (for recording storage)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-recordings-bucket

# OpenAI Configuration (for AI insights)
OPENAI_API_KEY=your_openai_key
```

## Testing

Run the test suite:

```bash
npm test
```

This will run all tests, including:
- Call service tests
- Recording service tests
- AI insights tests
- Component tests

## Error Handling

The services include comprehensive error handling:

```typescript
try {
  await callService.makeCall(options);
} catch (error) {
  if (error instanceof ProviderError) {
    // Handle provider-specific errors
  } else if (error instanceof ValidationError) {
    // Handle validation errors
  } else {
    // Handle other errors
  }
}
```

## Best Practices

1. Always use environment variables for sensitive configuration
2. Implement proper error handling
3. Use TypeScript types for better type safety
4. Follow the provider's rate limits
5. Implement retry logic for failed calls
6. Regularly backup call recordings
7. Monitor call analytics for quality issues
8. Use webhooks for real-time updates
9. Implement proper security measures
10. Keep the call service updated with the latest provider features

## Support

For issues and feature requests, please create an issue in the repository.