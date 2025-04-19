
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
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Session } from "@supabase/supabase-js";
import DashboardHeader from "@/components/DashboardHeader";

type Profile = {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
};

const Profile = () => {
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
        return;
      }
      setUserSession(data.session);
      fetchProfile(data.session.user.id);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          navigate("/auth");
        } else if (session) {
          setUserSession(session);
          fetchProfile(session.user.id);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile(data as Profile);
        setNickname(data.nickname || "");
      }
    } catch (error: any) {
      toast.error(`Error fetching profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!userSession) return;
    
    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({ nickname })
        .eq("id", userSession.user.id);
        
      if (error) {
        throw error;
      }
      
      toast.success("Profile updated successfully");
      
      if (profile) {
        setProfile({
          ...profile,
          nickname
        });
      }
    } catch (error: any) {
      toast.error(`Error updating profile: ${error.message}`);
    } finally {
      setUpdating(false);
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
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>
              View and update your profile information
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {loading ? (
              <p>Loading profile...</p>
            ) : profile ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname (displayed on leaderboard)</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter a nickname"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="joined">Joined</Label>
                  <Input
                    id="joined"
                    value={new Date(profile.created_at).toLocaleDateString()}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </>
            ) : (
              <p>No profile found.</p>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={handleLogout}
            >
              Log Out
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={updating || loading || !profile}
            >
              {updating ? "Updating..." : "Update Profile"}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
