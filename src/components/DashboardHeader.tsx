
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DashboardHeaderProps {
  userSession: Session | null;
  onLogout: () => void;
}

const DashboardHeader = ({ userSession, onLogout }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <h1 
            className="text-xl font-bold text-primary cursor-pointer" 
            onClick={() => navigate("/dashboard")}
          >
            NEET PG Prep
          </h1>
          <nav className="hidden md:flex ml-10 space-x-4">
            <Button 
              variant="link" 
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </Button>
            <Button 
              variant="link" 
              onClick={() => navigate("/add-session")}
            >
              Add Session
            </Button>
            <Button 
              variant="link" 
              onClick={() => navigate("/sessions")}
            >
              Sessions
            </Button>
            <Button 
              variant="link" 
              onClick={() => navigate("/leaderboard")}
            >
              Leaderboard
            </Button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/profile")}
          >
            Profile
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onLogout}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
