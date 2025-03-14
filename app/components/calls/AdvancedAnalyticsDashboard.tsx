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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
  Sankey,
  HeatMap,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CallAnalytics } from '@/lib/services/calls/types';
import { VoiceAnalysis } from '@/lib/services/calls/voice-analysis';

interface AdvancedAnalytics extends CallAnalytics {
  voiceAnalysis: VoiceAnalysis;
}

export function AdvancedAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AdvancedAnalytics[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>();
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, view]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/calls/advanced-analytics?' + new URLSearchParams({
        startDate: dateRange?.from.toISOString() || '',
        endDate: dateRange?.to.toISOString() || '',
        view,
      }));
      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareVoiceAnalysisData = () => {
    return analytics.map(a => ({
      date: new Date(a.createdAt).toLocaleDateString(),
      pitch: a.voiceAnalysis.pitch,
      energy: a.voiceAnalysis.energy,
      clarity: a.voiceAnalysis.clarity,
      emotion: a.voiceAnalysis.emotion,
    }));
  };

  const prepareEmotionFlowData = () => {
    const nodes = [
      { name: 'Start' },
      { name: 'Happy' },
      { name: 'Neutral' },
      { name: 'Frustrated' },
      { name: 'Resolved' },
    ];

    const links = analytics.reduce((acc, a) => {
      const emotionFlow = a.voiceAnalysis.emotionFlow;
      for (let i = 0; i < emotionFlow.length - 1; i++) {
        const source = emotionFlow[i];
        const target = emotionFlow[i + 1];
        const existingLink = acc.find(l => l.source === source && l.target === target);
        if (existingLink) {
          existingLink.value++;
        } else {
          acc.push({ source, target, value: 1 });
        }
      }
      return acc;
    }, [] as any[]);

    return { nodes, links };
  };

  const prepareKeywordTreemap = () => {
    return analytics.reduce((acc, a) => {
      a.voiceAnalysis.keywords.forEach(k => {
        const existing = acc.find(item => item.name === k.word);
        if (existing) {
          existing.value += k.frequency;
        } else {
          acc.push({ name: k.word, value: k.frequency });
        }
      });
      return acc;
    }, [] as any[]);
  };

  const prepareVoiceMetricsRadar = () => {
    return analytics.map(a => ({
      metric: 'Voice Metrics',
      pitch: a.voiceAnalysis.pitch,
      energy: a.voiceAnalysis.energy,
      clarity: a.voiceAnalysis.clarity,
      tempo: a.voiceAnalysis.tempo,
      variability: a.voiceAnalysis.variability,
    }));
  };

  const prepareSentimentHeatmap = () => {
    return analytics.map(a => ({
      time: new Date(a.createdAt).toLocaleTimeString(),
      sentiment: a.sentiment?.score || 0,
      energy: a.voiceAnalysis.energy,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Advanced Analytics</h2>
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

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Voice Analysis Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareVoiceAnalysisData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pitch" stroke="#8884d8" />
                  <Line type="monotone" dataKey="energy" stroke="#82ca9d" />
                  <Line type="monotone" dataKey="clarity" stroke="#ffc658" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emotion Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={prepareEmotionFlowData()}
                  node={{ fill: '#8884d8' }}
                  link={{ stroke: '#77c878' }}
                />
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyword Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={prepareKeywordTreemap()}
                  dataKey="value"
                  stroke="#fff"
                  fill="#8884d8"
                />
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={prepareVoiceMetricsRadar()}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis />
                  <Radar
                    name="Voice Metrics"
                    dataKey="value"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment & Energy Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <HeatMap
                  data={prepareSentimentHeatmap()}
                  dataKey="time"
                  name="Time"
                  xAxis={<XAxis dataKey="time" />}
                  yAxis={<YAxis dataKey="sentiment" />}
                />
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}