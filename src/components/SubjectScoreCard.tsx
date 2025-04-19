
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SubjectScoreCardProps {
  subject: string;
  score: number;
  count: number;
  weight: number;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
};

const getProgressColor = (score: number) => {
  if (score >= 80) return "bg-green-600";
  if (score >= 60) return "bg-blue-600";
  if (score >= 40) return "bg-yellow-600";
  return "bg-red-600";
};

const SubjectScoreCard = ({ subject, score, count, weight }: SubjectScoreCardProps) => {
  const roundedScore = Math.round(score);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          {subject}
          <span className="text-xs ml-2 text-gray-500">
            ({weight} weight)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className={`text-2xl font-bold ${getScoreColor(roundedScore)}`}>
              {roundedScore}%
            </span>
            <span className="text-sm text-gray-500">
              {count} session{count !== 1 ? "s" : ""}
            </span>
          </div>
          <Progress 
            value={roundedScore} 
            className="h-2"
            indicatorClassName={getProgressColor(roundedScore)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default SubjectScoreCard;
