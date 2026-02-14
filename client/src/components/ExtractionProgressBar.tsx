import React, { useEffect, useState } from 'react';
import { Progress } from './ui/progress';
import { Card } from './ui/card';
import { CheckCircle, Loader2, AlertCircle, FileText, Brain, Database, DollarSign, Cloud } from 'lucide-react';
import { trpc } from '../lib/trpc';

interface ExtractionProgressBarProps {
  documentId: string;
  projectDbName: string;
  onComplete?: () => void;
}

interface ProgressStage {
  name: string;
  label: string;
  icon: React.ReactNode;
  minProgress: number;
  maxProgress: number;
}

const STAGES: ProgressStage[] = [
  { name: 'text_extraction', label: 'Extracting Text', icon: <FileText className="w-4 h-4" />, minProgress: 0, maxProgress: 30 },
  { name: 'deterministic_extraction', label: 'Finding Patterns', icon: <Database className="w-4 h-4" />, minProgress: 30, maxProgress: 50 },
  { name: 'llm_extraction', label: 'AI Analysis (Pass 1-4)', icon: <Brain className="w-4 h-4" />, minProgress: 50, maxProgress: 90 },
  { name: 'generating_narratives', label: 'Generating Narratives', icon: <FileText className="w-4 h-4" />, minProgress: 90, maxProgress: 92 },
  { name: 'extracting_performance_params', label: 'Performance Data', icon: <Database className="w-4 h-4" />, minProgress: 92, maxProgress: 94 },
  { name: 'extracting_financial_data', label: 'Financial Data', icon: <DollarSign className="w-4 h-4" />, minProgress: 94, maxProgress: 96 },
  { name: 'extracting_weather_files', label: 'Weather Files', icon: <Cloud className="w-4 h-4" />, minProgress: 96, maxProgress: 98 },
  { name: 'checking_validation_trigger', label: 'Finalizing', icon: <CheckCircle className="w-4 h-4" />, minProgress: 98, maxProgress: 100 },
];

export function ExtractionProgressBar({ documentId, projectDbName, onComplete }: ExtractionProgressBarProps) {
  const [currentStage, setCurrentStage] = useState<string>('queued');
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');

  // Poll progress every 500ms
  const { data: progressData } = trpc.documents.getProgress.useQuery(
    { projectDbName, documentId },
    {
      refetchInterval: status === 'processing' ? 500 : false,
      enabled: !!projectDbName && !!documentId,
    }
  );

  useEffect(() => {
    if (progressData) {
      setCurrentStage(progressData.stage);
      setProgress(progressData.progress_percent);
      setStatus(progressData.status);
      setErrorMessage(progressData.error_message);

      // Calculate estimated time remaining
      if (progressData.status === 'processing' && progressData.progress_percent > 0) {
        const elapsed = Date.now() - startTime;
        const estimatedTotal = (elapsed / progressData.progress_percent) * 100;
        const remaining = estimatedTotal - elapsed;
        
        if (remaining > 0) {
          const seconds = Math.ceil(remaining / 1000);
          if (seconds < 60) {
            setEstimatedTimeRemaining(`~${seconds}s remaining`);
          } else {
            const minutes = Math.ceil(seconds / 60);
            setEstimatedTimeRemaining(`~${minutes}m remaining`);
          }
        }
      }

      // Call onComplete when finished
      if (progressData.status === 'completed' && onComplete) {
        onComplete();
      }
    }
  }, [progressData, startTime, onComplete]);

  // Find current stage info
  const currentStageInfo = STAGES.find(s => s.name === currentStage) || STAGES[0];
  const currentStageIndex = STAGES.findIndex(s => s.name === currentStage);

  if (status === 'failed') {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">Extraction Failed</h4>
            <p className="text-sm text-red-800 dark:text-red-200">{errorMessage || 'Unknown error occurred'}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'completed') {
    return (
      <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <h4 className="font-semibold text-green-900 dark:text-green-100">Extraction Complete</h4>
            <p className="text-sm text-green-800 dark:text-green-200">All insights have been extracted successfully</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <h4 className="font-semibold">Extracting Insights</h4>
          </div>
          <span className="text-sm text-muted-foreground">{estimatedTimeRemaining}</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{currentStageInfo.label}</span>
            <span className="font-medium">{progress}%</span>
          </div>
        </div>

        {/* Stage indicators */}
        <div className="grid grid-cols-4 gap-2">
          {STAGES.map((stage, index) => {
            const isComplete = index < currentStageIndex || status === 'completed';
            const isCurrent = index === currentStageIndex;
            const isPending = index > currentStageIndex;

            return (
              <div
                key={stage.name}
                className={`flex items-center gap-2 p-2 rounded-md text-xs transition-colors ${
                  isComplete
                    ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
                    : isCurrent
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                {isComplete ? (
                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin" />
                ) : (
                  <div className="w-3 h-3 flex-shrink-0">{stage.icon}</div>
                )}
                <span className="truncate">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
