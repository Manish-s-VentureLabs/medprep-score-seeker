
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
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const Sessions = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<Session | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");

  const subjects = [
    "Medicine", "Surgery", "OB-GYN", "Pediatrics",
    "Pathology", "Pharmacology", "Biochemistry", "Anatomy",
    "Physiology", "Microbiology", "Radiology", "Dermatology",
    "Psychiatry", "ENT", "Ophthalmology", "Anesthesia",
    "Forensic Medicine"
  ];

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
        .select("*");

      if (error) {
        throw error;
      }

      if (data) {
        setSessions(data as SessionType[]);
      }
    } catch (error: any) {
      toast.error(`Error fetching sessions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSessions = () => {
    return sessions.filter(session => {
      if (subjectFilter !== "all" && session.subject !== subjectFilter) {
        return false;
      }
      if (typeFilter !== "all" && session.type !== typeFilter) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "date-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "score-asc":
          return (a.correct_questions / a.total_questions) - (b.correct_questions / b.total_questions);
        case "score-desc":
          return (b.correct_questions / b.total_questions) - (a.correct_questions / a.total_questions);
        case "subject-asc":
          return a.subject.localeCompare(b.subject);
        case "subject-desc":
          return b.subject.localeCompare(a.subject);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast.error(`Error signing out: ${error.message}`);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Are you sure you want to delete this session?")) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", id);
        
      if (error) {
        throw error;
      }
      
      toast.success("Session deleted successfully");
      setSessions(sessions.filter(session => session.id !== id));
    } catch (error: any) {
      toast.error(`Error deleting session: ${error.message}`);
    }
  };

  const filteredSessions = getFilteredSessions();

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userSession={userSession} onLogout={handleLogout} />
      
      <main className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Your Sessions</CardTitle>
                <CardDescription>
                  View and manage your practice and mock test sessions
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/add-session")}>
                Add New Session
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Subject
                </label>
                <Select 
                  value={subjectFilter} 
                  onValueChange={setSubjectFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Type
                </label>
                <Select 
                  value={typeFilter} 
                  onValueChange={setTypeFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="mock">Mock Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <Select 
                  value={sortBy} 
                  onValueChange={setSortBy}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (Newest)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                    <SelectItem value="score-desc">Score (High to Low)</SelectItem>
                    <SelectItem value="score-asc">Score (Low to High)</SelectItem>
                    <SelectItem value="subject-asc">Subject (A-Z)</SelectItem>
                    <SelectItem value="subject-desc">Subject (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {loading ? (
              <p>Loading sessions...</p>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No sessions found.</p>
                <Button onClick={() => navigate("/add-session")}>
                  Add Your First Session
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Time (mins)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          {new Date(session.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{session.subject}</TableCell>
                        <TableCell className="capitalize">{session.type}</TableCell>
                        <TableCell>
                          {Math.round((session.correct_questions / session.total_questions) * 100)}%
                          <div className="text-xs text-gray-500">
                            {session.correct_questions}/{session.total_questions}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{session.difficulty}</TableCell>
                        <TableCell>{session.time_taken}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Sessions;
