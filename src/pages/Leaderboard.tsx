
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Session } from "@supabase/supabase-js";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProfileWithScore = {
  id: string;
  nickname: string | null;
  email: string;
  score: number;
};

// Function to calculate score (same as in Dashboard)
const calculateSessionScore = (session: any) => {
  const accuracy = session.correct_questions / session.total_questions;
  
  let difficultyMultiplier = 1.0;
  if (session.difficulty === "medium") difficultyMultiplier = 1.2;
  if (session.difficulty === "hard") difficultyMultiplier = 1.4;
  
  let confidenceMultiplier = 1.0;
  if (session.confidence === "low") confidenceMultiplier = 0.8;
  if (session.confidence === "high") confidenceMultiplier = 1.2;
  
  const guessPercent = session.guess_percent / 100;
  
  const daysSince = Math.abs(
    (new Date().getTime() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recentnessFactor = Math.exp(-daysSince / 30);
  
  const score = accuracy * difficultyMultiplier * confidenceMultiplier * 
               (1 - guessPercent * 0.3) * recentnessFactor;
               
  return score * 100; // Convert to 0-100 scale
};

const subjectWeights = {
  "Medicine": 15, "Surgery": 12, "OB-GYN": 10, "Pediatrics": 6,
  "Pathology": 6, "Pharmacology": 6, "Biochemistry": 5, "Anatomy": 4,
  "Physiology": 4, "Microbiology": 5, "Radiology": 5, "Dermatology": 3,
  "Psychiatry": 3, "ENT": 2, "Ophthalmology": 2, "Anesthesia": 2,
  "Forensic Medicine": 2
};

const Leaderboard = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<ProfileWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<Session | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
        return;
      }
      setUserSession(data.session);
      fetchLeaderboard(data.session.user.id);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          navigate("/auth");
        } else if (session) {
          setUserSession(session);
          fetchLeaderboard(session.user.id);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchLeaderboard = async (currentUserId: string) => {
    try {
      setLoading(true);
      
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
        
      if (profilesError) throw profilesError;
      
      // Get all sessions
      const { data: allSessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("*");
        
      if (sessionsError) throw sessionsError;
      
      if (profiles && allSessions) {
        const userScores: ProfileWithScore[] = [];
        
        // Calculate score for each user
        for (const profile of profiles) {
          const userSessions = allSessions.filter(s => s.user_id === profile.id);
          
          if (userSessions.length === 0) {
            // Skip users with no sessions
            continue;
          }
          
          // Group by subject
          const subjectGroups: Record<string, any[]> = {};
          userSessions.forEach(session => {
            if (!subjectGroups[session.subject]) {
              subjectGroups[session.subject] = [];
            }
            subjectGroups[session.subject].push(session);
          });
          
          // Calculate score for each subject
          let weightedTotalScore = 0;
          let totalWeight = 0;
          
          Object.entries(subjectGroups).forEach(([subject, sessions]) => {
            const weight = subjectWeights[subject as keyof typeof subjectWeights] || 1;
            totalWeight += weight;
            
            const practiceScores = calculateScoresForSessions(
              sessions.filter(s => s.type === "practice"),
              0.4
            );
            
            const mockScores = calculateScoresForSessions(
              sessions.filter(s => s.type === "mock"),
              0.6
            );
            
            const subjectScore = practiceScores + mockScores;
            const weightedScore = subjectScore * weight;
            
            weightedTotalScore += weightedScore;
          });
          
          // Calculate total score (normalized to 100)
          const normalizedTotalScore = totalWeight > 0 
            ? (weightedTotalScore / totalWeight) * 100
            : 0;
            
          userScores.push({
            id: profile.id,
            nickname: profile.nickname,
            email: profile.email,
            score: Math.min(Math.round(normalizedTotalScore), 100)
          });
        }
        
        // Sort by score (descending)
        userScores.sort((a, b) => b.score - a.score);
        
        setLeaderboard(userScores);
        
        // Find current user's rank
        const userIndex = userScores.findIndex(u => u.id === currentUserId);
        setCurrentUserRank(userIndex !== -1 ? userIndex + 1 : null);
      }
    } catch (error: any) {
      toast.error(`Error fetching leaderboard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateScoresForSessions = (sessions: any[], weight: number) => {
    if (sessions.length === 0) return 0;
    
    let totalScore = 0;
    sessions.forEach(session => {
      totalScore += calculateSessionScore(session);
    });
    
    return (totalScore / sessions.length) * weight;
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
      
      <main className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Global Leaderboard</CardTitle>
            <CardDescription>
              See how you rank against other test takers
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {currentUserRank !== null && (
              <div className="bg-primary/10 p-4 rounded-lg mb-6 border border-primary/20">
                <p className="font-medium">
                  Your current rank: <span className="text-primary font-bold">#{currentUserRank}</span> 
                  {currentUserRank === 1 ? " 🏆" : ""}
                </p>
              </div>
            )}
            
            {loading ? (
              <p>Loading leaderboard...</p>
            ) : leaderboard.length === 0 ? (
              <p>No users with scores yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((user, index) => (
                    <TableRow 
                      key={user.id}
                      className={user.id === userSession?.user.id ? "bg-primary/5" : ""}
                    >
                      <TableCell className="font-medium">
                        {index + 1}
                        {index === 0 && " 🏆"}
                        {index === 1 && " 🥈"}
                        {index === 2 && " 🥉"}
                      </TableCell>
                      <TableCell>
                        {user.nickname || user.email.split('@')[0]}
                        {user.id === userSession?.user.id && " (You)"}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {user.score}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Leaderboard;
