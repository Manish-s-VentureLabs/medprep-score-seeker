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
      
      // Get all profiles with prediction_score
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname, email, prediction_score")
        .order("prediction_score", { ascending: false });
        
      if (profilesError) throw profilesError;
      
      if (profiles) {
        // Transform profiles into leaderboard format
        const userScores: ProfileWithScore[] = profiles.map(profile => ({
          id: profile.id,
          nickname: profile.nickname,
          email: profile.email,
          score: profile.prediction_score !== null ? profile.prediction_score : 0
        }));
        
        // Sort users with null scores to the end
        userScores.sort((a, b) => {
          if (a.score === 0 && b.score === 0) return 0;
          if (a.score === 0) return 1;
          if (b.score === 0) return -1;
          return b.score - a.score;
        });
        
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
                        {user.score.toFixed(2)}
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
