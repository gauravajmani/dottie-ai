import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CallAnalytics } from '@/lib/services/calls/types';

interface CallWithAnalytics {
  id: string;
  to: string;
  from: string;
  createdAt: string;
  duration: number;
  analytics: CallAnalytics;
}

export function CallAnalyticsDashboard() {
  const [calls, setCalls] = useState<CallWithAnalytics[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>();
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, view]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/calls/analytics?' + new URLSearchParams({
        startDate: dateRange?.from.toISOString() || '',
        endDate: dateRange?.to.toISOString() || '',
        view,
      }));
      const data = await response.json();
      setCalls(data.calls);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageSentiment = () => {
    const callsWithSentiment = calls.filter(call => call.analytics?.sentiment);
    if (!callsWithSentiment.length) return 0;

    return callsWithSentiment.reduce((sum, call) => 
      sum + (call.analytics.sentiment?.score || 0), 0) / callsWithSentiment.length;
  };

  const calculateAverageDuration = () => {
    if (!calls.length) return 0;
    return calls.reduce((sum, call) => sum + call.duration, 0) / calls.length;
  };

  const prepareSentimentData = () => {
    return calls.map(call => ({
      time: new Date(call.createdAt).toLocaleDateString(),
      sentiment: call.analytics.sentiment?.score || 0,
      duration: call.duration,
    }));
  };

  const prepareTopicsData = () => {
    const topicsCount: Record<string, number> = {};
    calls.forEach(call => {
      call.analytics.topics?.forEach(topic => {
        topicsCount[topic] = (topicsCount[topic] || 0) + 1;
      });
    });

    return Object.entries(topicsCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const preparePaceData = () => {
    const paceCount = {
      slow: 0,
      normal: 0,
      fast: 0,
    };

    calls.forEach(call => {
      if (call.analytics.pace?.rating) {
        paceCount[call.analytics.pace.rating]++;
      }
    });

    return Object.entries(paceCount).map(([name, value]) => ({ name, value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Call Analytics</h2>
        <div className="flex space-x-4">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
          <Select
            value={view}
            onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setView(value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Average Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {calculateAverageSentiment().toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(calculateAverageDuration() / 60)} min
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{calls.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareSentimentData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sentiment"
                    stroke="#8884d8"
                    name="Sentiment Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Topics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareTopicsData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#82ca9d" name="Occurrences" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Speaking Pace Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={preparePaceData()}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  />
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Speaker Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Agent', value: 60 },
                      { name: 'Customer', value: 40 },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#82ca9d"
                    label
                  />
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}