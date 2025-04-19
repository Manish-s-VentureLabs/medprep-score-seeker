export const subjectWeights = {
  "Medicine": 15,
  "Surgery": 12,
  "OB-GYN": 10,
  "Pediatrics": 6,
  "Pathology": 6,
  "Pharmacology": 6,
  "Biochemistry": 5,
  "Anatomy": 4,
  "Physiology": 4,
  "Microbiology": 5,
  "Radiology": 5,
  "Dermatology": 3,
  "Psychiatry": 3,
  "ENT": 2,
  "Ophthalmology": 2,
  "Anesthesia": 2,
  "Forensic Medicine": 2
};

export function getMultiplier(type: 'difficulty' | 'confidence', value: string): number {
  const map = {
    difficulty: { easy: 1.0, medium: 1.2, hard: 1.4 },
    confidence: { low: 0.8, medium: 1.0, high: 1.2 }
  };
  return map[type][value as keyof typeof map[typeof type]] || 1.0;
}

export function getRecentnessFactor(dateStr: string): number {
  const daysOld = (Date.now() - new Date(dateStr).getTime()) / (1000 * 3600 * 24);
  return Math.exp(-daysOld / 30); // 1 month half-life decay
}

export function averageSessionScore(sessions: any[]): number {
  if (!sessions || sessions.length === 0) return 0;
  let total = 0;

  sessions.forEach(session => {
    const {
      correct_questions: correctQuestions,
      total_questions: totalQuestions,
      difficulty,
      confidence,
      guess_percent: guessPercent,
      created_at: date
    } = session;

    const accuracy = correctQuestions / totalQuestions;
    const difficultyMult = getMultiplier("difficulty", difficulty);
    const confidenceMult = getMultiplier("confidence", confidence);
    const guessFactor = 1 - (guessPercent / 100) * 0.3;
    const recentness = getRecentnessFactor(date);

    const score = accuracy * difficultyMult * confidenceMult * guessFactor * recentness;
    total += score;
  });

  return total / sessions.length;
}

export function calculatePrepScoreWithMocks(dataBySubject: Record<string, { practice: any[], mock: any[] }>): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const subject in subjectWeights) {
    const weight = subjectWeights[subject as keyof typeof subjectWeights];
    const data = dataBySubject[subject] || { practice: [], mock: [] };
    const practiceSessions = data.practice || [];
    const mockSessions = data.mock || [];

    const practiceScore = averageSessionScore(practiceSessions);
    const mockScore = averageSessionScore(mockSessions);

    const subjectScore = (practiceScore * 0.4 + mockScore * 0.6);
    totalScore += subjectScore * weight;
    totalWeight += weight;
  }

  return Number((totalScore / totalWeight * 100).toFixed(2)); // Final score out of 100
} 