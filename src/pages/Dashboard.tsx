import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardHeader from "@/components/DashboardHeader";
import SubjectScoreCard from "@/components/SubjectScoreCard";
import { BarChart, Bar } from "recharts";
import { Session } from "@supabase/supabase-js";
import { calculatePrepScoreWithMocks, getMultiplier, getRecentnessFactor } from "@/lib/scoring";

// Types
type SessionType = {
  id: string;
  subject: string;
  correct_questions: number;
  total_questions: number;
  difficulty: "easy" | "medium" | "hard";
  confidence: "low" | "medium" | "high";
  guess_percent: number;
  time_taken: number;
  type: "practice" | "mock";
  created_at: string;
};

type SubjectScore = {
  subject: string;
  score: number;
  count: number;
  weight: number;
};

type ScoreTrend = {
  date: string;
  score: number;
};

const subjectWeights = {
  "Medicine": 15, "Surgery": 12, "OB-GYN": 10, "Pediatrics": 6,
  "Pathology": 6, "Pharmacology": 6, "Biochemistry": 5, "Anatomy": 4,
  "Physiology": 4, "Microbiology": 5, "Radiology": 5, "Dermatology": 3,
  "Psychiatry": 3, "ENT": 2, "Ophthalmology": 2, "Anesthesia": 2,
  "Forensic Medicine": 2
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectScores, setSubjectScores] = useState<SubjectScore[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend[]>([]);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [userSession, setUserSession] = useState<Session | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session: userSession } } = await supabase.auth.getSession();
        if (!userSession) {
          setError("No active session");
          return;
        }

        // Fetch profile first to get stored prediction_score
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userSession.user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);
        // Update totalScore with the stored prediction_score
        setTotalScore(profileData?.prediction_score || 0);

        // Fetch score history
        const { data: scoreHistory, error: historyError } = await supabase
          .from("score_history")
          .select("*")
          .eq("user_id", userSession.user.id)
          .order("created_at", { ascending: true });

        if (historyError) throw historyError;

        // Generate last 7 days
        const last7Days = generateLast7Days();
        const trend: ScoreTrend[] = [];

        // For each day, find the latest score before or on that day
        last7Days.forEach(day => {
          const dayDate = new Date(day);
          // Find all scores for this day
          const dayScores = scoreHistory?.filter(record => {
            const recordDate = new Date(record.created_at);
            return recordDate.toDateString() === dayDate.toDateString();
          });

          // If we have scores for this day, use the latest one
          if (dayScores && dayScores.length > 0) {
            const latestScore = dayScores.reduce((latest, current) => {
              return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
            });
            trend.push({
              date: day,
              score: latestScore.score
            });
          } else {
            // If no scores for this day, find the most recent score before this day
            const previousScores = scoreHistory?.filter(record => 
              new Date(record.created_at) < dayDate
            );
            
            if (previousScores && previousScores.length > 0) {
              const latestPreviousScore = previousScores.reduce((latest, current) => {
                return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
              });
              trend.push({
                date: day,
                score: latestPreviousScore.score
              });
            } else {
              // If no previous scores either, use 0
              trend.push({
                date: day,
                score: 0
              });
            }
          }
        });

        console.log("Score History:", scoreHistory);
        console.log("Trend Data:", trend);
        setScoreTrend(trend);

        // Fetch sessions for other calculations
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .eq("user_id", userSession.user.id)
          .order("created_at", { ascending: false });

        if (sessionsError) throw sessionsError;
        setSessions(sessionsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Group sessions by subject and type
  const dataBySubject: Record<string, { practice: any[], mock: any[] }> = {};
  
  sessions.forEach(session => {
    if (!dataBySubject[session.subject]) {
      dataBySubject[session.subject] = { practice: [], mock: [] };
    }
    if (session.type === 'practice') {
      dataBySubject[session.subject].practice.push(session);
    } else {
      dataBySubject[session.subject].mock.push(session);
    }
  });

  const calculateSessionScore = (sessions: any[]): number => {
    if (sessions.length === 0) return 0;

    let total = 0;
    sessions.forEach(session => {
      const accuracy = session.correct_questions / session.total_questions;
      const difficultyMult = getMultiplier("difficulty", session.difficulty);
      const confidenceMult = getMultiplier("confidence", session.confidence);
      const guessFactor = 1 - (session.guess_percent / 100) * 0.3;
      const recentness = getRecentnessFactor(session.created_at);

      const score = accuracy * difficultyMult * confidenceMult * guessFactor * recentness;
      total += score;
    });

    return total / sessions.length;
  };

  const generateLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  // Calculate subject scores and trend
  useEffect(() => {
    if (sessions.length > 0) {
      // Calculate individual subject scores
      const scores: SubjectScore[] = [];
      for (const subject in dataBySubject) {
        const subjectData = dataBySubject[subject];
        const practiceScore = calculateSessionScore(subjectData.practice);
        const mockScore = calculateSessionScore(subjectData.mock);
        const subjectScore = (practiceScore * 0.4 + mockScore * 0.6) * 100;

        scores.push({
          subject,
          score: subjectScore,
          count: subjectData.practice.length + subjectData.mock.length,
          weight: subjectWeights[subject as keyof typeof subjectWeights] || 1
        });
      }

      scores.sort((a, b) => b.score - a.score);
      setSubjectScores(scores);
    }
  }, [sessions]);

  const getMotivationalMessage = () => {
    if (subjectScores.length === 0) return "Start tracking your progress by adding sessions!";
  
    const bestSubject = subjectScores[0];
    const worstSubject = subjectScores[subjectScores.length - 1];
  
    if (scoreTrend.length >= 3) {
      const latest = scoreTrend[scoreTrend.length - 1].score;
      const previous = scoreTrend[scoreTrend.length - 3].score;
  
      if (latest > previous) {
        return `Great progress! Your scores are improving. Keep focusing on ${worstSubject.subject} to get even better.`;
      }
    }
  
    if (bestSubject.score > 70) {
      return `You're doing great in ${bestSubject.subject}, but need to focus more on ${worstSubject.subject}.`;
    }
  
    return `Keep practicing! Focus on ${worstSubject.subject} to improve your overall score.`;
  };
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast.error(`Error signing out: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userSession={userSession} onLogout={handleLogout} />
      
      <main className="container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Your Preparation Score</CardTitle>
              <CardDescription>{getMotivationalMessage()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-5xl font-bold text-primary">{totalScore}</h3>
                  <p className="text-sm text-muted-foreground mt-1">out of 100</p>
                </div>
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Score", value: totalScore },
                          { name: "Remaining", value: 100 - totalScore }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={45}
                        fill="#8884d8"
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full"
                onClick={() => navigate("/add-session")}
              >
                Add New Session
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => navigate("/sessions")}
              >
                View All Sessions
              </Button>
              <Button 
                className="w-full" 
                variant="outline" 
                onClick={() => navigate("/leaderboard")}
              >
                View Leaderboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="mb-6">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Progress</CardTitle>
                <CardDescription>Your prediction score changes over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p>Loading score history...</p>
                ) : scoreTrend.length === 0 ? (
                  <p>No score history available yet. Add some sessions to see your progress!</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={scoreTrend}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          tickFormatter={(value) => `${value.toFixed(1)}`}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toFixed(2)}`, "Score"]}
                          labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#8884d8" 
                          name="Prediction Score" 
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="subjects">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectScores.map((subject) => (
                <SubjectScoreCard 
                  key={subject.subject}
                  subject={subject.subject}
                  score={subject.score}
                  count={subject.count}
                  weight={subject.weight}
                />
              ))}
              {subjectScores.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-6 text-center">
                    <p>No subject data yet. Start adding your practice sessions!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="trend">
            <Card>
              <CardHeader>
                <CardTitle>Subject Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectScores}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="score" fill="#8884d8" name="Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p>No sessions yet. Start by adding your first practice or mock session!</p>
            ) : (
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sessions.slice(0, 5).map((session) => (
                      <tr key={session.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{session.subject}</td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">{session.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {session.correct_questions}/{session.total_questions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(session.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessions.length > 5 && (
                  <div className="px-6 py-3 bg-gray-50 text-right">
                    <Button variant="link" onClick={() => navigate("/sessions")}>
                      View all sessions
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
