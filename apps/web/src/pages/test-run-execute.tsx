import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileUpload } from '@/components/file-upload';
import { 
  ArrowLeft, 
  Play,
  CheckCircle,
  XCircle,
  SkipForward,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  BarChart3,
  Paperclip
} from 'lucide-react';

export function TestRunExecutePage() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>();
  const navigate = useNavigate();
  const runIdNum = Number(runId);

  const { data: run, isLoading: isLoadingRun } = trpc.testRuns.get.useQuery(
    { id: runIdNum },
    { enabled: !!runId }
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showAutoCompleteDialog, setShowAutoCompleteDialog] = useState(false);

  const utils = trpc.useContext();

  const updateResult = trpc.testRuns.updateResult.useMutation({
    onSuccess: () => {
      utils.testRuns.get.invalidate({ id: runIdNum });
      setNotes('');
      
      if (run) {
        const isLastTest = currentIndex >= run.items.length - 1;
        const willBeComplete = run.results.filter(r => r.status !== 'not_run').length + 1 >= run.items.length;
        
        if (isLastTest && willBeComplete) {
          // This was the last test - show auto-complete dialog
          setShowAutoCompleteDialog(true);
        } else if (currentIndex < run.items.length - 1) {
          // Move to next test
          setCurrentIndex(prev => prev + 1);
        }
      }
    },
  });

  const completeRun = trpc.testRuns.complete.useMutation({
    onSuccess: () => {
      utils.testRuns.get.invalidate({ id: runIdNum });
      setShowCompleteDialog(false);
      setShowAutoCompleteDialog(false);
      // Navigate to results page
      navigate(`/projects/${projectId}/runs/${runId}/results`);
    },
  });

  const handleResult = (status: 'passed' | 'failed' | 'skipped' | 'blocked') => {
    if (!run || !run.items[currentIndex]) return;
    
    const currentItem = run.items[currentIndex];
    updateResult.mutate({
      runId: runIdNum,
      testCaseVersionId: currentItem.testCaseVersionId,
      status,
      notes: notes || undefined,
    });
  };

  const handleAutoComplete = () => {
    completeRun.mutate({ id: runIdNum });
  };

  const handleContinueTesting = () => {
    setShowAutoCompleteDialog(false);
    // Navigate to the runs list if they don't want to complete
    navigate(`/projects/${projectId}/runs`);
  };

  if (isLoadingRun) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Test Run not found</h2>
        <Button className="mt-4" asChild>
          <Link to={`/projects/${projectId}/runs`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Test Runs
          </Link>
        </Button>
      </div>
    );
  }

  const currentItem = run.items[currentIndex];
  const currentTestCase = currentItem?.testCaseVersion;
  const currentResult = currentItem ? run.results.find(r => r.testCaseVersionId === currentItem.testCaseVersionId) : null;
  const totalTests = run.items.length;
  const completedTests = run.results.filter(r => r.status !== 'not_run').length;
  const progress = totalTests > 0 ? (completedTests / totalTests) * 100 : 0;

  // Calculate statistics
  const stats = {
    passed: run.results.filter(r => r.status === 'passed').length,
    failed: run.results.filter(r => r.status === 'failed').length,
    skipped: run.results.filter(r => r.status === 'skipped').length,
    blocked: run.results.filter(r => r.status === 'blocked').length,
    notRun: run.results.filter(r => r.status === 'not_run').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={`/projects/${projectId}/runs`} className="hover:text-foreground">Test Runs</Link>
            <span>/</span>
            <span>{run.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{run.name}</h1>
          {run.description && (
            <p className="text-muted-foreground">{run.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}/runs`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          {!run.completedAt && (
            <Button onClick={() => setShowCompleteDialog(true)}>
              <Flag className="mr-2 h-4 w-4" />
              Complete Run
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Progress</CardTitle>
            <span className="text-sm text-muted-foreground">
              {completedTests} of {totalTests} tests completed
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-2 mb-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{stats.passed} passed</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>{stats.failed} failed</span>
            </div>
            <div className="flex items-center gap-1">
              <SkipForward className="h-4 w-4 text-yellow-500" />
              <span>{stats.skipped} skipped</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>{stats.notRun} pending</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Complete Dialog */}
      <Dialog open={showAutoCompleteDialog} onOpenChange={setShowAutoCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              All Tests Completed!
            </DialogTitle>
            <DialogDescription>
              You've completed all {totalTests} tests in this run. Would you like to mark the test run as complete?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
                <div className="text-green-700">Passed</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-red-700">Failed</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
                <div className="text-yellow-700">Skipped</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.blocked}</div>
                <div className="text-gray-700">Blocked</div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleContinueTesting} className="w-full sm:w-auto">
              Continue Testing
            </Button>
            <Button 
              onClick={handleAutoComplete} 
              disabled={completeRun.isPending}
              className="w-full sm:w-auto"
            >
              {completeRun.isPending ? 'Completing...' : 'Complete Run & View Results'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Complete Run Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Test Run?</DialogTitle>
            <DialogDescription>
              Are you sure you want to complete this test run? 
              {stats.notRun > 0 && ` ${stats.notRun} tests are still pending.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Continue Testing
            </Button>
            <Button 
              onClick={() => completeRun.mutate({ id: runIdNum })}
              disabled={completeRun.isPending}
            >
              {completeRun.isPending ? 'Completing...' : 'Complete Run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Current Test Case */}
      {currentTestCase ? (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{currentTestCase.title}</CardTitle>
                  <Badge className={
                    currentTestCase.priority === 'critical' ? 'bg-red-100 text-red-800' :
                    currentTestCase.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    currentTestCase.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }>
                    {currentTestCase.priority}
                  </Badge>
                </div>
                {currentTestCase.description && (
                  <CardDescription>{currentTestCase.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {currentIndex + 1} / {totalTests}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentIndex === totalTests - 1}
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Steps */}
            <div>
              <h3 className="font-semibold mb-3">Steps:</h3>
              <ol className="list-decimal list-inside space-y-2">
                {currentTestCase.steps.map((step, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground pl-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Expected Result */}
            {currentTestCase.expectedResult && (
              <div>
                <h3 className="font-semibold mb-2">Expected Result:</h3>
                <p className="text-sm text-muted-foreground">{currentTestCase.expectedResult}</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <h3 className="font-semibold mb-2">Notes:</h3>
              <Textarea
                placeholder="Add any observations or issues..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Attachments */}
            {currentResult && currentResult.id && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </h3>
                <FileUpload
                  entityType="test_result"
                  entityId={currentResult.id}
                  existingFiles={currentResult.files || []}
                  onUploadComplete={() => {
                    utils.testRuns.get.invalidate({ id: runIdNum });
                  }}
                />
              </div>
            )}

            {/* Action Buttons */}
            {!run.completedAt && (
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => handleResult('passed')}
                  disabled={updateResult.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Pass
                </Button>
                <Button 
                  onClick={() => handleResult('failed')}
                  disabled={updateResult.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Fail
                </Button>
                <Button 
                  onClick={() => handleResult('skipped')}
                  disabled={updateResult.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="text-center space-y-3">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="text-lg font-medium">All tests completed!</h3>
            <p className="text-sm text-muted-foreground">
              You've gone through all {totalTests} tests in this run.
            </p>
            {!run.completedAt && (
              <Button onClick={() => setShowCompleteDialog(true)} className="mt-4">
                <Flag className="mr-2 h-4 w-4" />
                Complete Test Run
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
