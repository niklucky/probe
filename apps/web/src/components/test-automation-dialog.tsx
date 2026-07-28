import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Check,
  Code2,
  Download,
  Play,
  RefreshCw,
  StopCircle,
  Trash2,
} from 'lucide-react';

interface TestAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  productId: number;
  testCaseId: number;
  sourceTestCaseVersionId: number;
  sourceVersionNumber: number;
  canGenerate: boolean;
}

export function TestAutomationDialog({
  open,
  onOpenChange,
  projectId,
  productId,
  testCaseId,
  sourceTestCaseVersionId,
  sourceVersionNumber,
  canGenerate,
}: TestAutomationDialogProps) {
  const [environmentId, setEnvironmentId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [executionAutomationId, setExecutionAutomationId] = useState<
    number | null
  >(null);

  const utils = trpc.useContext();
  const { data: environments = [] } = trpc.environments.list.useQuery(
    { projectId, productId },
    { enabled: open },
  );
  const { data: connections = [] } = trpc.aiConnections.available.useQuery(
    { scope: 'test-authoring' },
    { enabled: open },
  );
  const { data: automations = [] } = trpc.testAutomations.list.useQuery(
    { testCaseId },
    { enabled: open },
  );

  useEffect(() => {
    if (!environmentId && environments.length) {
      const preferred =
        environments.find((environment) => environment.isDefault) ??
        environments[0];
      setEnvironmentId(String(preferred?.id ?? ''));
    }
  }, [environmentId, environments]);

  useEffect(() => {
    if (!open) {
      setProposalId(null);
      setSource('');
      setError('');
      setExecutionAutomationId(null);
    }
  }, [open]);

  const generate = trpc.testAutomations.generate.useMutation({
    onSuccess: (automation) => {
      setProposalId(automation.id);
      setSource(automation.source);
      setError('');
      utils.testAutomations.list.invalidate({ testCaseId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const accept = trpc.testAutomations.accept.useMutation({
    onSuccess: () => {
      setProposalId(null);
      setSource('');
      setError('');
      utils.testAutomations.list.invalidate({ testCaseId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const discard = trpc.testAutomations.discard.useMutation({
    onSuccess: () => {
      setProposalId(null);
      setSource('');
      setError('');
      utils.testAutomations.list.invalidate({ testCaseId });
    },
    onError: (requestError) => setError(requestError.message),
  });

  const selectedConnection = connectionId
    ? connectionId.startsWith('env:')
      ? connectionId
      : Number(connectionId)
    : undefined;
  const busy = generate.isPending || accept.isPending || discard.isPending;

  const requestGeneration = () => {
    setError('');
    generate.mutate({
      testCaseId,
      sourceTestCaseVersionId,
      environmentId: Number(environmentId),
      connectionId: selectedConnection,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>Playwright TypeScript automation</DialogTitle>
          <DialogDescription>
            Generate an editable proposal from accepted manual version{' '}
            {sourceVersionNumber}. Every regeneration creates a separate,
            auditable automation version.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!canGenerate && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Manual version is not ready</AlertTitle>
              <AlertDescription>
                Mark the test case Ready before requesting automation.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="automation-environment">Environment</Label>
              <select
                id="automation-environment"
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={environmentId}
                onChange={(event) => setEnvironmentId(event.target.value)}
              >
                <option value="">Choose an environment</option>
                {environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name} — {environment.baseUrl}
                    {environment.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="automation-connection">AI connection</Label>
              <select
                id="automation-connection"
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={connectionId}
                onChange={(event) => setConnectionId(event.target.value)}
              >
                <option value="">Default test-authoring connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={String(connection.id)}>
                    {connection.name} — {connection.model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Automation action failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {proposalId ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="automation-source">Editable proposal</Label>
                <Badge variant="outline">Syntax checked · formatted</Badge>
              </div>
              <Textarea
                id="automation-source"
                className="min-h-[360px] font-mono text-xs"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                spellCheck={false}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => discard.mutate({ id: proposalId })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !environmentId || !canGenerate}
                  onClick={requestGeneration}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  disabled={busy || !source.trim()}
                  onClick={() => accept.mutate({ id: proposalId, source })}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Accept
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              disabled={busy || !environmentId || !canGenerate}
              onClick={requestGeneration}
            >
              <Code2 className="mr-2 h-4 w-4" />
              {generate.isPending ? 'Generating…' : 'Generate automation'}
            </Button>
          )}

          <div className="grid gap-2 border-t pt-4">
            <h3 className="font-medium">Automation history</h3>
            {automations.length ? (
              automations.map((automation) => (
                <button
                  type="button"
                  key={automation.id}
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted/50"
                  onClick={() => {
                    if (automation.status === 'generated') {
                      setProposalId(automation.id);
                      setSource(automation.source);
                    } else if (automation.status === 'accepted') {
                      setExecutionAutomationId(
                        executionAutomationId === automation.id
                          ? null
                          : automation.id,
                      );
                    }
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">
                      Automation v{automation.versionNumber} · manual v
                      {automation.sourceVersionNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {automation.environmentName} · {automation.provider}/
                      {automation.model}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {automation.stale && (
                      <Badge variant="destructive">Stale</Badge>
                    )}
                    <Badge
                      variant={
                        automation.status === 'accepted' ? 'default' : 'outline'
                      }
                    >
                      {automation.status}
                    </Badge>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No automation has been generated for this test case.
              </p>
            )}
            {executionAutomationId && (
              <AutomationExecutionHistory
                automationId={executionAutomationId}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const terminalStatuses = new Set([
  'passed',
  'failed',
  'timed_out',
  'cancelled',
  'infrastructure_error',
]);

function AutomationExecutionHistory({
  automationId,
}: {
  automationId: number;
}) {
  const [error, setError] = useState('');
  const [captureVideo, setCaptureVideo] = useState(false);
  const utils = trpc.useContext();
  const { data: jobs = [] } = trpc.automationExecutions.list.useQuery(
    { automationId },
    { refetchInterval: 2000 },
  );
  const queue = trpc.automationExecutions.queue.useMutation({
    onSuccess: () => {
      setError('');
      utils.automationExecutions.list.invalidate({ automationId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const cancel = trpc.automationExecutions.cancel.useMutation({
    onSuccess: () =>
      utils.automationExecutions.list.invalidate({ automationId }),
    onError: (requestError) => setError(requestError.message),
  });
  const artifactUrl = trpc.automationExecutions.artifactUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
    onError: (requestError) => setError(requestError.message),
  });

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Execution history</h4>
          <p className="text-xs text-muted-foreground">
            Runs continue asynchronously if this dialog is closed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={captureVideo}
              onChange={(event) => setCaptureVideo(event.target.checked)}
            />
            Video on failure
          </label>
          <Button
            size="sm"
            disabled={queue.isPending}
            onClick={() =>
              queue.mutate({
                automationId,
                timeoutSeconds: 300,
                captureVideo,
              })
            }
          >
            <Play className="mr-2 h-4 w-4" />
            {queue.isPending ? 'Queuing…' : 'Run accepted version'}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {jobs.length ? (
        jobs.map((job) => (
          <div key={job.id} className="rounded-md border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Run #{job.id}</span>
                  <Badge
                    variant={
                      job.status === 'passed'
                        ? 'default'
                        : [
                              'failed',
                              'timed_out',
                              'infrastructure_error',
                            ].includes(job.status)
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {job.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Attempt {job.attempt}/{job.maxAttempts} · timeout{' '}
                  {job.timeoutSeconds}s
                  {job.resultSummary
                    ? ` · ${job.resultSummary.durationMs}ms`
                    : ''}
                </p>
              </div>
              {!terminalStatuses.has(job.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate({ id: job.id })}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
            {job.errorMessage && (
              <p className="mt-2 text-xs text-destructive">
                {job.errorMessage}
              </p>
            )}
            {job.structuredLogs.length > 0 && (
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">
                {job.structuredLogs
                  .slice(-20)
                  .map((entry) => entry.message)
                  .join('\n')}
              </pre>
            )}
            {job.artifacts && job.artifacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {job.artifacts.map((artifact) => (
                  <Button
                    key={artifact.id}
                    size="sm"
                    variant="outline"
                    disabled={artifactUrl.isPending}
                    onClick={() =>
                      artifactUrl.mutate({
                        jobId: job.id,
                        artifactId: artifact.id,
                      })
                    }
                  >
                    <Download className="mr-2 h-3 w-3" />
                    {artifact.kind}: {artifact.originalName}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          This accepted automation has not been run yet.
        </p>
      )}
    </div>
  );
}
