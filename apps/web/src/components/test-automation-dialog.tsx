import { useEffect, useRef, useState } from 'react';
import type { BrowserAuthoringSession } from '@probe/shared';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle,
  Check,
  Code2,
  Download,
  Play,
  RefreshCw,
  StopCircle,
  Trash2,
  Wrench,
} from 'lucide-react';

interface TestAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  testCaseId: number;
  sourceTestCaseVersionId: number;
  sourceVersionNumber: number;
  canGenerate: boolean;
}

export function TestAutomationDialog({
  open,
  onOpenChange,
  productId,
  testCaseId,
  sourceTestCaseVersionId,
  sourceVersionNumber,
  canGenerate,
}: TestAutomationDialogProps) {
  const [environmentId, setEnvironmentId] = useState('');
  const [environmentProfileId, setEnvironmentProfileId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [selectedAutomationId, setSelectedAutomationId] = useState<
    number | null
  >(null);
  const [browserAssisted, setBrowserAssisted] = useState(false);
  const [authoringSessionId, setAuthoringSessionId] = useState<number | null>(
    null,
  );
  const invalidatedAutomationId = useRef<number | null>(null);

  const utils = trpc.useContext();
  const { data: environments = [] } = trpc.environments.list.useQuery(
    { productId },
    { enabled: open },
  );
  const { data: connections = [] } = trpc.aiConnections.available.useQuery(
    { scope: 'test-authoring' },
    { enabled: open },
  );
  const { data: profiles = [] } = trpc.environments.listProfiles.useQuery(
    { environmentId: Number(environmentId) || 0 },
    { enabled: open && Boolean(environmentId) },
  );
  const { data: automations = [] } = trpc.testAutomations.list.useQuery(
    { testCaseId },
    { enabled: open },
  );
  const { data: authoringSessions = [] } = trpc.browserAuthoring.list.useQuery(
    { testCaseId },
    { enabled: open },
  );
  const { data: authoringSession } = trpc.browserAuthoring.get.useQuery(
    { id: authoringSessionId || 0 },
    {
      enabled: open && Boolean(authoringSessionId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status &&
          ['completed', 'failed', 'cancelled', 'timed_out'].includes(status)
          ? false
          : 1500;
      },
    },
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
    setEnvironmentProfileId('');
  }, [environmentId]);

  useEffect(() => {
    if (!open) {
      setProposalId(null);
      setSource('');
      setError('');
      setSelectedAutomationId(null);
      setAuthoringSessionId(null);
      invalidatedAutomationId.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || authoringSessionId) return;
    const active = authoringSessions.find(
      ({ status }) =>
        !['completed', 'failed', 'cancelled', 'timed_out'].includes(status),
    );
    if (active) {
      setBrowserAssisted(true);
      setAuthoringSessionId(active.id);
    }
  }, [authoringSessionId, authoringSessions, open]);

  useEffect(() => {
    if (!authoringSession?.generatedAutomationId) return;
    const automation = automations.find(
      ({ id }) => id === authoringSession.generatedAutomationId,
    );
    if (!automation) {
      if (
        invalidatedAutomationId.current !==
        authoringSession.generatedAutomationId
      ) {
        invalidatedAutomationId.current =
          authoringSession.generatedAutomationId;
        utils.testAutomations.list.invalidate({ testCaseId });
      }
      return;
    }
    if (automation) {
      invalidatedAutomationId.current = null;
      setProposalId(automation.id);
      setSelectedAutomationId(automation.id);
      setSource(automation.source);
    }
  }, [authoringSession, automations, testCaseId, utils.testAutomations.list]);

  const generate = trpc.testAutomations.generate.useMutation({
    onSuccess: (automation) => {
      setProposalId(automation.id);
      setSource(automation.source);
      setSelectedAutomationId(automation.id);
      setError('');
      utils.testAutomations.list.invalidate({ testCaseId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const accept = trpc.testAutomations.accept.useMutation({
    onSuccess: (automation) => {
      setProposalId(null);
      setSource('');
      setSelectedAutomationId(automation.id);
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
  const startBrowserAuthoring = trpc.browserAuthoring.start.useMutation({
    onSuccess: (session) => {
      setAuthoringSessionId(session.id);
      setError('');
      utils.browserAuthoring.list.invalidate({ testCaseId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const cancelBrowserAuthoring = trpc.browserAuthoring.cancel.useMutation({
    onSuccess: () => {
      setError('');
      utils.browserAuthoring.list.invalidate({ testCaseId });
    },
    onError: (requestError) => setError(requestError.message),
  });

  const selectedConnection = connectionId
    ? connectionId.startsWith('env:')
      ? connectionId
      : Number(connectionId)
    : undefined;
  const authoringActive = Boolean(
    authoringSession &&
    !['completed', 'failed', 'cancelled', 'timed_out'].includes(
      authoringSession.status,
    ),
  );
  const busy =
    generate.isPending ||
    accept.isPending ||
    discard.isPending ||
    startBrowserAuthoring.isPending ||
    cancelBrowserAuthoring.isPending ||
    authoringActive;
  const selectedAutomation = automations.find(
    (automation) => automation.id === selectedAutomationId,
  );

  const requestGeneration = () => {
    setError('');
    if (browserAssisted) {
      startBrowserAuthoring.mutate({
        testCaseId,
        sourceTestCaseVersionId,
        environmentId: Number(environmentId),
        environmentProfileId: Number(environmentProfileId),
        connectionId: selectedConnection,
      });
      return;
    }
    generate.mutate({
      testCaseId,
      sourceTestCaseVersionId,
      environmentId: Number(environmentId),
      environmentProfileId: Number(environmentProfileId),
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

          <div className="grid gap-4 md:grid-cols-3">
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
              <Label htmlFor="automation-profile">Browser profile</Label>
              <select
                id="automation-profile"
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={environmentProfileId}
                onChange={(event) =>
                  setEnvironmentProfileId(event.target.value)
                }
                disabled={!environmentId}
              >
                <option value="">Choose a profile</option>
                {profiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                    disabled={!profile.enabled}
                  >
                    {profile.name}
                    {profile.isAnonymous ? ' (no authentication)' : ''}
                    {!profile.enabled ? ' (disabled)' : ''}
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

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="browser-assisted-generation"
              checked={browserAssisted}
              disabled={authoringActive}
              onCheckedChange={(checked) =>
                setBrowserAssisted(checked === true)
              }
            />
            <div className="grid gap-1">
              <Label htmlFor="browser-assisted-generation">
                Browser-assisted generation
              </Label>
              <p className="text-sm text-muted-foreground">
                Let the model inspect and interact with the selected environment
                before writing and validating the test. This may take several
                minutes and use additional AI tokens.
              </p>
            </div>
          </div>

          {authoringSession && (
            <BrowserAuthoringProgress
              session={authoringSession}
              cancelling={cancelBrowserAuthoring.isPending}
              onCancel={() =>
                cancelBrowserAuthoring.mutate({ id: authoringSession.id })
              }
            />
          )}

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
                  disabled={
                    busy ||
                    !environmentId ||
                    !environmentProfileId ||
                    !canGenerate
                  }
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
              disabled={
                busy || !environmentId || !environmentProfileId || !canGenerate
              }
              onClick={requestGeneration}
            >
              <Code2 className="mr-2 h-4 w-4" />
              {startBrowserAuthoring.isPending
                ? 'Starting browser…'
                : generate.isPending
                  ? 'Generating…'
                  : 'Generate automation'}
            </Button>
          )}

          <div className="grid gap-2 border-t pt-4">
            <h3 className="font-medium">Automation history</h3>
            {automations.length ? (
              automations.map((automation) => (
                <button
                  type="button"
                  key={automation.id}
                  aria-pressed={selectedAutomationId === automation.id}
                  className={`flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted/50 ${
                    selectedAutomationId === automation.id
                      ? 'border-primary bg-muted/50'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedAutomationId(automation.id);
                    if (automation.status === 'generated') {
                      setProposalId(automation.id);
                      setSource(automation.source);
                    }
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">
                      Automation v{automation.versionNumber} · manual v
                      {automation.sourceVersionNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {automation.environmentName} ·{' '}
                      {automation.environmentProfileName ?? 'Legacy profile'} ·{' '}
                      {automation.provider}/{automation.model}
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
            {selectedAutomation &&
              selectedAutomation.status !== 'generated' && (
                <div className="mt-2 grid gap-2 rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor={`automation-source-${selectedAutomation.id}`}
                    >
                      Automation v{selectedAutomation.versionNumber} source
                    </Label>
                    <Badge variant="outline">Read only</Badge>
                  </div>
                  <Textarea
                    id={`automation-source-${selectedAutomation.id}`}
                    className="min-h-[360px] bg-background font-mono text-xs"
                    value={selectedAutomation.source}
                    readOnly
                    spellCheck={false}
                  />
                </div>
              )}
            {selectedAutomation?.status === 'accepted' && (
              <AutomationExecutionHistory
                automationId={selectedAutomation.id}
                environmentId={selectedAutomation.environmentId}
                preferredProfileId={selectedAutomation.environmentProfileId}
                preferredProfileRevision={
                  selectedAutomation.environmentProfileRevision
                }
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

const authoringPhases = [
  ['starting_browser', 'Starting browser'],
  ['inspecting_page', 'Inspecting page'],
  ['exploring_manual_steps', 'Exploring manual-test steps'],
  ['generating_automation', 'Generating automation'],
  ['validating_automation', 'Validating automation'],
  ['complete', 'Complete'],
] as const;

function BrowserAuthoringProgress({
  session,
  cancelling,
  onCancel,
}: {
  session: BrowserAuthoringSession;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const terminal = ['completed', 'failed', 'cancelled', 'timed_out'].includes(
    session.status,
  );
  const currentIndex = authoringPhases.findIndex(
    ([phase]) => phase === session.phase,
  );
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Browser-assisted progress</div>
          <div className="text-xs text-muted-foreground">
            {session.toolCallCount} of {session.maxToolCalls} browser actions ·{' '}
            {session.totalTokens ?? 0} AI tokens
          </div>
        </div>
        {!terminal && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cancelling}
            onClick={onCancel}
          >
            <StopCircle className="mr-2 h-4 w-4" />
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>
      <ol className="grid gap-1 text-sm sm:grid-cols-3">
        {authoringPhases.map(([phase, label], index) => (
          <li
            key={phase}
            className={
              index <= currentIndex && session.phase !== 'failed'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            {index < currentIndex || session.status === 'completed' ? '✓ ' : ''}
            {label}
          </li>
        ))}
      </ol>
      {session.status === 'completed' &&
        session.validationStatus !== 'passed' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Proposal generated; validation did not pass</AlertTitle>
            <AlertDescription>
              {session.failureReason ||
                'Review and edit the proposal before accepting it.'}
            </AlertDescription>
          </Alert>
        )}
      {['failed', 'cancelled', 'timed_out'].includes(session.status) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Browser-assisted generation {session.status}</AlertTitle>
          <AlertDescription>
            {session.failureReason || 'The session did not complete.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
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
  environmentId,
  preferredProfileId,
  preferredProfileRevision,
}: {
  automationId: number;
  environmentId: number;
  preferredProfileId: number | null;
  preferredProfileRevision: number | null;
}) {
  const [error, setError] = useState('');
  const [captureVideo, setCaptureVideo] = useState(false);
  const [applyEnvironmentCookies, setApplyEnvironmentCookies] = useState(true);
  const [applyEnvironmentHeaders, setApplyEnvironmentHeaders] = useState(true);
  const [profileId, setProfileId] = useState(
    preferredProfileId ? String(preferredProfileId) : '',
  );
  const utils = trpc.useContext();
  const { data: jobs = [] } = trpc.automationExecutions.list.useQuery(
    { automationId },
    { refetchInterval: 2000 },
  );
  const { data: profiles = [], isLoading: profilesLoading } =
    trpc.environments.listProfiles.useQuery({ environmentId });
  useEffect(() => {
    setProfileId(preferredProfileId ? String(preferredProfileId) : '');
  }, [automationId, preferredProfileId]);
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
  const selectedProfile = profiles.find(
    (profile) => profile.id === Number(profileId),
  );
  const hasRunnableProfile = Boolean(
    selectedProfile?.enabled &&
    selectedProfile.id === preferredProfileId &&
    selectedProfile.revision === preferredProfileRevision,
  );

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
          <select
            aria-label="Execution browser profile"
            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
          >
            <option value="">Choose profile</option>
            {profiles.map((profile) => (
              <option
                key={profile.id}
                value={profile.id}
                disabled={
                  !profile.enabled ||
                  profile.id !== preferredProfileId ||
                  profile.revision !== preferredProfileRevision
                }
              >
                {profile.name}
                {!profile.enabled ? ' (disabled)' : ''}
                {profile.id === preferredProfileId &&
                profile.revision !== preferredProfileRevision
                  ? ' (changed)'
                  : ''}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={captureVideo}
              onChange={(event) => setCaptureVideo(event.target.checked)}
            />
            Video on failure
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={applyEnvironmentCookies}
              onChange={(event) =>
                setApplyEnvironmentCookies(event.target.checked)
              }
            />
            Environment cookies
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={applyEnvironmentHeaders}
              onChange={(event) =>
                setApplyEnvironmentHeaders(event.target.checked)
              }
            />
            Environment headers
          </label>
          <Button
            size="sm"
            disabled={queue.isPending || !hasRunnableProfile}
            onClick={() =>
              queue.mutate({
                automationId,
                environmentProfileId: Number(profileId),
                timeoutSeconds: 300,
                captureVideo,
                applyEnvironmentCookies,
                applyEnvironmentHeaders,
              })
            }
          >
            <Play className="mr-2 h-4 w-4" />
            {queue.isPending ? 'Queuing…' : 'Run accepted version'}
          </Button>
        </div>
      </div>
      {!profilesLoading && !hasRunnableProfile && (
        <p className="text-sm text-destructive">
          The automation&apos;s environment profile was deleted, disabled, or
          changed. Regenerate the automation before running it.
        </p>
      )}
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
                  {job.environmentProfileName
                    ? ` · profile ${job.environmentProfileName}`
                    : ''}
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
            {['failed', 'timed_out'].includes(job.status) && (
              <AutomationRepairPanel executionId={job.id} />
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

function AutomationRepairPanel({ executionId }: { executionId: number }) {
  const [mode, setMode] = useState<'review' | 'automatic'>('review');
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [maxTotalTokens, setMaxTotalTokens] = useState(20_000);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(600);
  const [connectionId, setConnectionId] = useState('');
  const [error, setError] = useState('');
  const utils = trpc.useContext();
  const { data: sessions = [] } = trpc.automationRepairs.list.useQuery(
    { executionId },
    { refetchInterval: 2000 },
  );
  const { data: connections = [] } = trpc.aiConnections.available.useQuery({
    scope: 'test-execution',
  });
  const session = sessions[0];
  const request = trpc.automationRepairs.request.useMutation({
    onSuccess: () => {
      setError('');
      utils.automationRepairs.list.invalidate({ executionId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const continueRepair = trpc.automationRepairs.continue.useMutation({
    onSuccess: () => {
      setError('');
      utils.automationRepairs.list.invalidate({ executionId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const execute = trpc.automationRepairs.execute.useMutation({
    onSuccess: () => {
      setError('');
      utils.automationRepairs.list.invalidate({ executionId });
    },
    onError: (requestError) => setError(requestError.message),
  });
  const promote = trpc.testAutomations.accept.useMutation({
    onSuccess: () => {
      setError('');
      utils.testAutomations.list.invalidate();
    },
    onError: (requestError) => setError(requestError.message),
  });
  const latestAttempt = session?.attempts[session.attempts.length - 1];

  if (!session) {
    return (
      <div className="mt-3 grid gap-2 rounded-md border border-dashed p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="h-4 w-4" />
          Bounded AI repair
        </div>
        <p className="text-xs text-muted-foreground">
          Probe classifies the failure before sending sanitized, size-limited
          evidence to an AI provider. Repair never changes the accepted source.
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <label className="grid gap-1 text-xs">
            Mode
            <select
              className="h-8 rounded border bg-background px-2"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as 'review' | 'automatic')
              }
            >
              <option value="review">Review before retry</option>
              <option value="automatic">Automatic (opt-in)</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Attempts
            <input
              className="h-8 rounded border bg-background px-2"
              type="number"
              min={1}
              max={5}
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Token budget
            <input
              className="h-8 rounded border bg-background px-2"
              type="number"
              min={100}
              value={maxTotalTokens}
              onChange={(event) =>
                setMaxTotalTokens(Number(event.target.value))
              }
            />
          </label>
          <label className="grid gap-1 text-xs">
            Total seconds
            <input
              className="h-8 rounded border bg-background px-2"
              type="number"
              min={30}
              value={maxDurationSeconds}
              onChange={(event) =>
                setMaxDurationSeconds(Number(event.target.value))
              }
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs">
          AI connection
          <select
            className="h-8 rounded border bg-background px-2"
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
          >
            <option value="">Default test-execution connection</option>
            {connections.map((connection) => (
              <option key={connection.id} value={String(connection.id)}>
                {connection.name} — {connection.model}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={request.isPending}
          onClick={() =>
            request.mutate({
              executionId,
              mode,
              connectionId: connectionId
                ? connectionId.startsWith('env:')
                  ? connectionId
                  : Number(connectionId)
                : undefined,
              limits: { maxAttempts, maxTotalTokens, maxDurationSeconds },
            })
          }
        >
          <Wrench className="mr-2 h-4 w-4" />
          {request.isPending ? 'Diagnosing…' : 'Diagnose and propose repair'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" /> Repair session #{session.id}
            <Badge variant="outline">{session.classification}</Badge>
            <Badge variant="outline">{session.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.diagnosis}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {session.attempts.length}/{session.maxAttempts} attempts ·{' '}
          {session.usedTokens}/{session.maxTotalTokens} tokens
        </p>
      </div>
      {session.stopReason && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{session.stopReason}</AlertDescription>
        </Alert>
      )}
      {session.attempts.map((attempt) => (
        <div key={attempt.id} className="grid gap-2 rounded border p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              Attempt {attempt.attemptNumber} · candidate automation v
              {attempt.candidateAutomation.versionNumber}
            </span>
            <Badge
              variant={attempt.status === 'passed' ? 'default' : 'outline'}
            >
              {attempt.status}
            </Badge>
          </div>
          <p className="text-xs">{attempt.explanation}</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">
            {attempt.sourceDiff}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            {attempt.provider}/{attempt.model} · prompt {attempt.promptVersion}
            {attempt.totalTokens ? ` · ${attempt.totalTokens} tokens` : ''}
          </p>
          <div className="flex justify-end gap-2">
            {session.status === 'awaiting_review' &&
              attempt.status === 'generated' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={execute.isPending}
                  onClick={() =>
                    execute.mutate({
                      sessionId: session.id,
                      attemptId: attempt.id,
                    })
                  }
                >
                  <Play className="mr-2 h-3 w-3" /> Run candidate
                </Button>
              )}
            {attempt.status === 'passed' &&
              attempt.candidateAutomation.status === 'generated' && (
                <Button
                  size="sm"
                  disabled={promote.isPending}
                  onClick={() =>
                    promote.mutate({
                      id: attempt.candidateAutomation.id,
                      source: attempt.candidateAutomation.source,
                    })
                  }
                >
                  <Check className="mr-2 h-3 w-3" /> Promote explicitly
                </Button>
              )}
          </div>
        </div>
      ))}
      {session.mode === 'review' &&
        session.status === 'active' &&
        latestAttempt?.status === 'failed' && (
          <Button
            size="sm"
            variant="outline"
            disabled={continueRepair.isPending}
            onClick={() => continueRepair.mutate({ id: session.id })}
          >
            <RefreshCw className="mr-2 h-3 w-3" /> Propose next bounded attempt
          </Button>
        )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        A passing repair confirms only this automation run; it does not prove
        the application is correct. Manual test-case versions are never changed.
      </p>
    </div>
  );
}
