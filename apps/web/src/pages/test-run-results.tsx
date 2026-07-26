import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  CheckCircle,
  XCircle,
  SkipForward,
  Clock,
  AlertCircle,
  BarChart3,
  RotateCcw,
} from 'lucide-react';

export function TestRunResultsPage() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>();
  const runIdNum = Number(runId);

  const { data: run, isLoading: isLoadingRun } = trpc.testRuns.get.useQuery(
    { id: runIdNum },
    { enabled: !!runId }
  );

  if (isLoadingRun) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[200px]" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
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

  const stats = run.stats || {
    passed: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    notRun: 0,
    total: 0,
  };

  const passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

  // Group results by status
  const passedTests = run.results.filter(r => r.status === 'passed');
  const failedTests = run.results.filter(r => r.status === 'failed');
  const skippedTests = run.results.filter(r => r.status === 'skipped');
  const blockedTests = run.results.filter(r => r.status === 'blocked');
  const notRunTests = run.results.filter(r => r.status === 'not_run');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={`/projects/${projectId}/runs`} className="hover:text-foreground">Test Runs</Link>
            <span>/</span>
            <span>{run.name}</span>
            <span>/</span>
            <span>Results</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{run.name}</h1>
          {run.description && (
            <p className="text-muted-foreground">{run.description}</p>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Badge variant={run.completedAt ? 'secondary' : 'default'}>
              {run.completedAt ? 'Completed' : 'In Progress'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(run.startedAt).toLocaleDateString()}
              {run.completedAt && ` - ${new Date(run.completedAt).toLocaleDateString()}`}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}/runs`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Runs
            </Link>
          </Button>
          {!run.completedAt && (
            <Button asChild>
              <Link to={`/projects/${projectId}/runs/${runId}/execute`}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Continue Run
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.passed}</div>
            <div className="text-sm text-green-700">
              {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-red-700">
              {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-700 flex items-center gap-2">
              <SkipForward className="h-4 w-4" />
              Skipped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.skipped}</div>
            <div className="text-sm text-yellow-700">
              {stats.total > 0 ? Math.round((stats.skipped / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-sm text-gray-700">
              {passRate}% pass rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Test Run Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden flex">
            {stats.passed > 0 && (
              <div 
                className="bg-green-500 h-full"
                style={{ width: `${(stats.passed / stats.total) * 100}%` }}
              />
            )}
            {stats.failed > 0 && (
              <div 
                className="bg-red-500 h-full"
                style={{ width: `${(stats.failed / stats.total) * 100}%` }}
              />
            )}
            {stats.skipped > 0 && (
              <div 
                className="bg-yellow-500 h-full"
                style={{ width: `${(stats.skipped / stats.total) * 100}%` }}
              />
            )}
            {stats.blocked > 0 && (
              <div 
                className="bg-orange-500 h-full"
                style={{ width: `${(stats.blocked / stats.total) * 100}%` }}
              />
            )}
            {stats.notRun > 0 && (
              <div 
                className="bg-gray-300 h-full"
                style={{ width: `${(stats.notRun / stats.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-3 text-sm flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Passed ({stats.passed})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>Failed ({stats.failed})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded" />
              <span>Skipped ({stats.skipped})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded" />
              <span>Blocked ({stats.blocked})</span>
            </div>
            {stats.notRun > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-300 rounded" />
                <span>Not Run ({stats.notRun})</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Results by Status */}
      <div className="space-y-4">
        {failedTests.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Failed Tests ({failedTests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {failedTests.map((result, idx) => (
                <div key={result.id} className={`p-4 ${idx !== failedTests.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{result.testCaseVersion?.title}</h4>
                      {result.notes && (
                        <p className="text-sm text-red-600 mt-1">{result.notes}</p>
                      )}
                      {result.executedBy && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Executed by {result.executedBy.name} on{' '}
                          {result.executedAt && new Date(result.executedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="destructive">Failed</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {passedTests.length > 0 && (
          <Card>
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-700 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Passed Tests ({passedTests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {passedTests.slice(0, 5).map((result, idx) => (
                <div key={result.id} className={`p-4 ${idx !== Math.min(passedTests.length, 5) - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{result.testCaseVersion?.title}</h4>
                      {result.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{result.notes}</p>
                      )}
                    </div>
                    <Badge className="bg-green-100 text-green-800">Passed</Badge>
                  </div>
                </div>
              ))}
              {passedTests.length > 5 && (
                <div className="p-4 text-center text-sm text-muted-foreground border-t">
                  + {passedTests.length - 5} more passed tests
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {skippedTests.length > 0 && (
          <Card>
            <CardHeader className="bg-yellow-50">
              <CardTitle className="text-yellow-700 flex items-center gap-2">
                <SkipForward className="h-5 w-5" />
                Skipped Tests ({skippedTests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {skippedTests.map((result, idx) => (
                <div key={result.id} className={`p-4 ${idx !== skippedTests.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{result.testCaseVersion?.title}</h4>
                      {result.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{result.notes}</p>
                      )}
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Skipped</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {blockedTests.length > 0 && (
          <Card>
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-orange-700 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Blocked Tests ({blockedTests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {blockedTests.map((result, idx) => (
                <div key={result.id} className={`p-4 ${idx !== blockedTests.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{result.testCaseVersion?.title}</h4>
                      {result.notes && (
                        <p className="text-sm text-orange-600 mt-1">{result.notes}</p>
                      )}
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">Blocked</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {notRunTests.length > 0 && (
          <Card>
            <CardHeader className="bg-gray-50">
              <CardTitle className="text-gray-700 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Not Executed ({notRunTests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notRunTests.map((result, idx) => (
                <div key={result.id} className={`p-4 ${idx !== notRunTests.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-muted-foreground">
                      {result.testCaseVersion?.title}
                    </h4>
                    <Badge variant="outline">Not Run</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
