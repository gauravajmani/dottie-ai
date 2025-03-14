import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { CallStatus } from '@/lib/services/calls/types';

interface Call {
  id: string;
  to: string;
  from: string;
  status: CallStatus;
  recordingUrl?: string;
  transcription?: string;
  provider: 'twilio' | 'vapi';
  createdAt: string;
}

export function CallManager() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [provider, setProvider] = useState<'twilio' | 'vapi'>('twilio');
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(true);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const response = await fetch('/api/calls');
      const data = await response.json();
      setCalls(data.calls);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch calls',
        variant: 'destructive',
      });
    }
  };

  const handleMakeCall = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          from,
          provider,
          recordingEnabled,
          transcriptionEnabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to make call');

      toast({
        title: 'Success',
        description: 'Call initiated successfully',
      });

      setTo('');
      setFrom('');
      await fetchCalls();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to make call',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Make a Call</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="To Phone Number"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <Input
                placeholder="From Phone Number"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={provider}
                onValueChange={(value: 'twilio' | 'vapi') => setProvider(value)}
              >
                <option value="twilio">Twilio</option>
                <option value="vapi">VAPI</option>
              </Select>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={recordingEnabled}
                    onChange={(e) => setRecordingEnabled(e.target.checked)}
                  />
                  <span>Record</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={transcriptionEnabled}
                    onChange={(e) => setTranscriptionEnabled(e.target.checked)}
                  />
                  <span>Transcribe</span>
                </label>
              </div>
            </div>
            <Button
              onClick={handleMakeCall}
              disabled={loading || !to || !from}
              className="w-full"
            >
              {loading ? 'Making Call...' : 'Make Call'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calls.map((call) => (
              <div
                key={call.id}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">To: {call.to}</p>
                    <p className="text-sm text-gray-500">From: {call.from}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{call.status}</p>
                    <p className="text-sm text-gray-500">{call.provider}</p>
                  </div>
                </div>
                {call.recordingUrl && (
                  <audio controls src={call.recordingUrl} className="w-full" />
                )}
                {call.transcription && (
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {call.transcription}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(call.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}