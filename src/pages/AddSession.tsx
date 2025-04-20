import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Session } from "@supabase/supabase-js";
import DashboardHeader from "@/components/DashboardHeader";
import { calculatePrepScoreWithMocks } from "@/lib/scoring";

const subjects = [
  "Medicine", "Surgery", "OB-GYN", "Pediatrics",
  "Pathology", "Pharmacology", "Biochemistry", "Anatomy",
  "Physiology", "Microbiology", "Radiology", "Dermatology",
  "Psychiatry", "ENT", "Ophthalmology", "Anesthesia",
  "Forensic Medicine"
];

const AddSession = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [correctQuestions, setCorrectQuestions] = useState<string>("");
  const [totalQuestions, setTotalQuestions] = useState<string>("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");
  const [guessPercent, setGuessPercent] = useState<number>(0);
  const [timeTaken, setTimeTaken] = useState<string>("");
  const [sessionType, setSessionType] = useState<"practice" | "mock">("practice");
  const [loading, setLoading] = useState(false);
  const [userSession, setUserSession] = useState<Session | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
        return;
      }
      setUserSession(data.session);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const correctQuestionsNum = parseInt(correctQuestions) || 0;
    const totalQuestionsNum = parseInt(totalQuestions) || 0;
    const timeTakenNum = parseInt(timeTaken) || 0;
    
    if (correctQuestionsNum > totalQuestionsNum) {
      toast.error("Correct questions cannot exceed total questions");
      return;
    }
    
    if (!subject) {
      toast.error("Please select a subject");
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.from("sessions").insert({
        user_id: userSession?.user.id,
        subject,
        correct_questions: correctQuestionsNum,
        total_questions: totalQuestionsNum,
        difficulty,
        confidence,
        guess_percent: guessPercent,
        time_taken: timeTakenNum,
        type: sessionType
      });

      if (error) {
        throw error;
      }

      // Calculate new score
      const { data: sessions } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userSession?.user.id);

      if (sessions) {
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

        // Calculate new score
        const newScore = calculatePrepScoreWithMocks(dataBySubject);

        // Update profile with new score
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ prediction_score: newScore })
          .eq("id", userSession?.user.id);

        if (updateError) {
          throw updateError;
        }

        // Record the score change in history
        const { error: historyError } = await supabase
          .from("score_history")
          .insert({
            user_id: userSession?.user.id,
            score: newScore,
            created_at: new Date().toISOString()
          });

        if (historyError) {
          throw historyError;
        }
      }

      toast.success("Session added successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(`Error adding session: ${error.message}`);
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
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Add New Session</CardTitle>
            <CardDescription>
              Track your practice and mock test performance
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="session-type">Session Type</Label>
                  <Select 
                    value={sessionType} 
                    onValueChange={(value) => setSessionType(value as "practice" | "mock")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="practice">Practice</SelectItem>
                      <SelectItem value="mock">Mock Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select 
                    value={subject} 
                    onValueChange={setSubject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="correct-questions">Correct Questions</Label>
                  <Input
                    id="correct-questions"
                    type="number"
                    min="0"
                    value={correctQuestions}
                    onChange={(e) => setCorrectQuestions(e.target.value)}
                    placeholder="Enter number of correct questions"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="total-questions">Total Questions</Label>
                  <Input
                    id="total-questions"
                    type="number"
                    min="1"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                    placeholder="Enter total number of questions"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select 
                    value={difficulty} 
                    onValueChange={(value) => setDifficulty(value as "easy" | "medium" | "hard")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confidence">Confidence Level</Label>
                  <Select 
                    value={confidence} 
                    onValueChange={(value) => setConfidence(value as "low" | "medium" | "high")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select confidence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-taken">Time Taken (minutes)</Label>
                  <Input
                    id="time-taken"
                    type="number"
                    min="1"
                    value={timeTaken}
                    onChange={(e) => setTimeTaken(e.target.value)}
                    placeholder="Enter time taken in minutes"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="guess-percent">Guesswork Percentage: {guessPercent}%</Label>
                  </div>
                  <Slider
                    id="guess-percent"
                    min={0}
                    max={100}
                    step={5}
                    value={[guessPercent]}
                    onValueChange={(value) => setGuessPercent(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0% (All confident)</span>
                    <span>100% (All guesswork)</span>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => navigate("/dashboard")}
                type="button"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !subject || !totalQuestions || !timeTaken || parseInt(totalQuestions) < 1 || parseInt(timeTaken) < 1}
              >
                {loading ? "Saving..." : "Save Session"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default AddSession;
