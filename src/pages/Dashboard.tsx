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
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [subjectScores, setSubjectScores] = useState<SubjectScore[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend[]>([]);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<Session | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
        return;
      }
      setUserSession(data.session);
      fetchSessions();
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          navigate("/auth");
        } else if (session) {
          setUserSession(session);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setSessions(data as SessionType[]);
        calculateScores(data as SessionType[]);
      }
    } catch (error: any) {
      toast.error(`Error fetching sessions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateScores = (sessions: SessionType[]) => {
    // Group sessions by subject and type
    const dataBySubject: Record<string, { practice: SessionType[], mock: SessionType[] }> = {};
    
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

    // Calculate overall score using new algorithm
    const totalScore = calculatePrepScoreWithMocks(dataBySubject);
    setTotalScore(totalScore);

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

    // Calculate score trend
    const last7Days = generateLast7Days();
    const scoreByDay: Record<string, { sum: number; count: number }> = {};

    last7Days.forEach(day => {
      scoreByDay[day] = { sum: 0, count: 0 };
    });

    sessions.forEach(session => {
      const day = new Date(session.created_at).toISOString().split('T')[0];
      if (scoreByDay[day]) {
        const score = calculateSessionScore([session]) * 100;
        scoreByDay[day].sum += score;
        scoreByDay[day].count += 1;
      }
    });

    const trend = last7Days.map(day => ({
      date: day,
      score: scoreByDay[day].count > 0
        ? scoreByDay[day].sum / scoreByDay[day].count
        : 0
    }));

    setScoreTrend(trend);
  };

  const calculateSessionScore = (sessions: SessionType[]): number => {
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
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#8884d8" 
                        name="Daily Score" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
            {loading ? (
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sessions.slice(0, 5).map((session) => (
                      <tr key={session.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{session.subject}</td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">{session.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {Math.round(calculateSessionScore([session]))}%
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
