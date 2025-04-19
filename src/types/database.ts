
export type SubjectType = 
  | 'Medicine' | 'Surgery' | 'OB-GYN' | 'Pediatrics' | 'Pathology' 
  | 'Pharmacology' | 'Biochemistry' | 'Anatomy' | 'Physiology' 
  | 'Microbiology' | 'Radiology' | 'Dermatology' | 'Psychiatry' 
  | 'ENT' | 'Ophthalmology' | 'Anesthesia' | 'Forensic Medicine';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type SessionType = 'practice' | 'mock';

export interface Profile {
  id: string;
  email: string;
  nickname: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  subject: SubjectType;
  correct_questions: number;
  total_questions: number;
  difficulty: DifficultyLevel;
  confidence: ConfidenceLevel;
  guess_percent: number;
  time_taken: number;
  type: SessionType;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
      };
    };
  };
}
