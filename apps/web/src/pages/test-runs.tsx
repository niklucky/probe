import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Plus, 
  Play,
  BarChart3
} from 'lucide-react';

export function TestRunsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);

  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { id },
    { enabled: !!id }
  );

  const { data: testRuns } = trpc.testRuns.list.useQuery(
    { projectId: id },
    { enabled: !!id }
  );

  if (isLoadingProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <Button className="mt-4" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link to={`/projects/${projectId}`} className="hover:text-foreground">{project.name}</Link>
            <span>/</span>
            <span>Test Runs</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Test Runs</h1>
          <p className="text-muted-foreground">
            Execute and track test results
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/projects/${projectId}/runs/create`}>
              <Plus className="mr-2 h-4 w-4" />
              New Run
            </Link>
          </Button>
        </div>
      </div>

      {/* Test Runs List */}
      {testRuns && testRuns.length > 0 ? (
        <div className="space-y-4">
          {testRuns.map((run) => (
            <Card key={run.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{run.name}</CardTitle>
                      <Badge variant={run.completedAt ? 'secondary' : 'default'}>
                        {run.completedAt ? 'Completed' : 'In Progress'}
                      </Badge>
                    </div>
                    {run.description && (
                      <CardDescription>{run.description}</CardDescription>
                    )}
                  </div>
                  <Button size="sm" asChild>
                    <Link to={run.completedAt 
                      ? `/projects/${projectId}/runs/${run.id}/results` 
                      : `/projects/${projectId}/runs/${run.id}/execute`
                    }>
                      <Play className="mr-2 h-4 w-4" />
                      {run.completedAt ? 'View Results' : 'Continue Run'}
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                  <span>Started {new Date(run.startedAt).toLocaleDateString()}</span>
                  {run.completedAt && (
                    <span>Completed {new Date(run.completedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {/* TODO: Show stats */}
                      0 passed, 0 failed, 0 skipped
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <div className="text-center space-y-3">
            <Play className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No test runs yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create your first test run to start executing tests and tracking results.
            </p>
            <Button className="mt-4" asChild>
              <Link to={`/projects/${projectId}/runs/create`}>
                <Plus className="mr-2 h-4 w-4" />
                Create Test Run
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
