import { useEffect, useState } from 'react';
import type { TestSpec } from '@probe/shared/schemas/test-cases';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Plus, Sparkles, Trash2 } from 'lucide-react';

type Mode = 'generate' | 'improve';

interface AiTestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  suiteId: number;
  productId: number;
  testCaseId?: number;
  currentSpec?: TestSpec;
  onAccepted: () => void;
}

function editableSpec(spec: TestSpec): TestSpec {
  return {
    ...spec,
    description: spec.description || '',
    prerequisites: [...spec.prerequisites],
    steps: spec.steps.map((step) => ({ ...step })),
    tags: [...spec.tags],
  };
}

function changedFields(before: TestSpec, after: TestSpec) {
  const fields: Array<[keyof TestSpec, string]> = [
    ['title', 'Title'],
    ['description', 'Description'],
    ['prerequisites', 'Prerequisites'],
    ['steps', 'Steps'],
    ['expectedResult', 'Expected result'],
    ['priority', 'Priority'],
    ['tags', 'Tags'],
  ];
  return fields
    .filter(
      ([field]) =>
        JSON.stringify(before[field] ?? '') !==
        JSON.stringify(after[field] ?? ''),
    )
    .map(([, label]) => label);
}

export function AiTestCaseDialog({
  open,
  onOpenChange,
  mode,
  suiteId,
  productId,
  testCaseId,
  currentSpec,
  onAccepted,
}: AiTestCaseDialogProps) {
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [proposal, setProposal] = useState<TestSpec | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const { data: connections = [] } = trpc.aiConnections.available.useQuery(
    { scope: 'test-authoring' },
    { enabled: open },
  );
  const { data: environments = [] } = trpc.environments.list.useQuery(
    { productId },
    { enabled: open },
  );

  useEffect(() => {
    if (!open) {
      setDescription('');
      setInstruction('');
      setEnvironmentId('');
      setProposal(null);
      setJobId(null);
      setError('');
    }
  }, [open, mode, testCaseId]);

  const requestProposal = trpc.aiAuthoring.request.useMutation({
    onSuccess: (result) => {
      setProposal(editableSpec(result.proposal));
      setJobId(result.id);
      setError('');
    },
    onError: (requestError) => setError(requestError.message),
  });
  const acceptProposal = trpc.aiAuthoring.accept.useMutation({
    onSuccess: () => {
      onAccepted();
      onOpenChange(false);
    },
    onError: (acceptError) => setError(acceptError.message),
  });
  const discardProposal = trpc.aiAuthoring.discard.useMutation({
    onError: (discardError) => setError(discardError.message),
  });

  const selectedConnection = connectionId
    ? connectionId.startsWith('env:')
      ? connectionId
      : Number(connectionId)
    : undefined;

  const generate = async () => {
    setError('');
    if (jobId) {
      await discardProposal.mutateAsync({ jobId });
      setJobId(null);
      setProposal(null);
    }
    requestProposal.mutate({
      operation: mode,
      suiteId,
      testCaseId: mode === 'improve' ? testCaseId : undefined,
      description: mode === 'generate' ? description : undefined,
      instruction: mode === 'improve' ? instruction || undefined : undefined,
      environmentId: environmentId ? Number(environmentId) : undefined,
      connectionId: selectedConnection,
    });
  };

  const updateStep = (
    index: number,
    field: 'action' | 'expectedResult',
    value: string,
  ) => {
    if (!proposal) return;
    const steps = proposal.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, [field]: value } : step,
    );
    setProposal({ ...proposal, steps });
  };

  const busy =
    requestProposal.isPending ||
    acceptProposal.isPending ||
    discardProposal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'generate'
              ? 'Generate test case with AI'
              : 'Improve test case with AI'}
          </DialogTitle>
          <DialogDescription>
            AI creates an editable proposal. Your current test case is unchanged
            until you explicitly accept it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ai-connection">AI connection</Label>
            <select
              id="ai-connection"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={connectionId}
              onChange={(event) => setConnectionId(event.target.value)}
            >
              <option value="">Default test-authoring connection</option>
              {connections.map((connection) => (
                <option key={connection.id} value={String(connection.id)}>
                  {connection.name} — {connection.model}
                  {connection.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-environment">
              Target environment (optional)
            </Label>
            <select
              id="ai-environment"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={environmentId}
              onChange={(event) => setEnvironmentId(event.target.value)}
            >
              <option value="">No environment context</option>
              {environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name} — {environment.baseUrl}
                  {environment.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {mode === 'generate' ? (
            <div className="grid gap-2">
              <Label htmlFor="ai-description">What should be tested?</Label>
              <Textarea
                id="ai-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="For example: verify that a signed-in user can reset their password and is required to log in again."
                rows={4}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="ai-instruction">
                Improvement instruction (optional)
              </Label>
              <Textarea
                id="ai-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="For example: add negative cases and make each expected result measurable."
                rows={3}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>AI proposal failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!proposal ? (
            <Button
              type="button"
              onClick={generate}
              disabled={busy || (mode === 'generate' && !description.trim())}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {requestProposal.isPending
                ? 'Creating proposal…'
                : mode === 'generate'
                  ? 'Generate proposal'
                  : 'Improve draft'}
            </Button>
          ) : (
            <>
              {mode === 'improve' && currentSpec && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="outline">Before</Badge>
                        <span className="text-sm font-medium">
                          {currentSpec.title}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {currentSpec.steps.length} steps ·{' '}
                        {currentSpec.prerequisites.length} prerequisites ·{' '}
                        {currentSpec.priority} priority
                      </p>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge>Proposed</Badge>
                        <span className="text-sm font-medium">
                          {proposal.title}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {proposal.steps.length} steps ·{' '}
                        {proposal.prerequisites.length} prerequisites ·{' '}
                        {proposal.priority} priority
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <span>Changed fields:</span>
                    {changedFields(currentSpec, proposal).map((field) => (
                      <Badge key={field} variant="secondary">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 rounded-lg border p-4">
                <div className="grid gap-2">
                  <Label htmlFor="proposal-title">Title</Label>
                  <Input
                    id="proposal-title"
                    value={proposal.title}
                    onChange={(event) =>
                      setProposal({ ...proposal, title: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="proposal-description">Description</Label>
                  <Textarea
                    id="proposal-description"
                    value={proposal.description || ''}
                    onChange={(event) =>
                      setProposal({
                        ...proposal,
                        description: event.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="proposal-priority">Priority</Label>
                    <select
                      id="proposal-priority"
                      className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={proposal.priority}
                      onChange={(event) =>
                        setProposal({
                          ...proposal,
                          priority: event.target.value as TestSpec['priority'],
                        })
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="proposal-tags">Tags</Label>
                    <Input
                      id="proposal-tags"
                      value={proposal.tags.join(', ')}
                      onChange={(event) =>
                        setProposal({
                          ...proposal,
                          tags: event.target.value
                            .split(',')
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="proposal-prerequisites">Prerequisites</Label>
                  <Textarea
                    id="proposal-prerequisites"
                    value={proposal.prerequisites.join('\n')}
                    onChange={(event) =>
                      setProposal({
                        ...proposal,
                        prerequisites: event.target.value
                          .split('\n')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Steps</Label>
                  {proposal.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 rounded-md border p-2"
                    >
                      <span className="pt-2 text-sm font-medium">
                        {index + 1}.
                      </span>
                      <div className="grid flex-1 gap-2">
                        <Input
                          value={step.action}
                          onChange={(event) =>
                            updateStep(index, 'action', event.target.value)
                          }
                          placeholder="Action"
                        />
                        <Input
                          value={step.expectedResult || ''}
                          onChange={(event) =>
                            updateStep(
                              index,
                              'expectedResult',
                              event.target.value,
                            )
                          }
                          placeholder="Expected result (optional)"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={proposal.steps.length === 1}
                        onClick={() =>
                          setProposal({
                            ...proposal,
                            steps: proposal.steps.filter(
                              (_, stepIndex) => stepIndex !== index,
                            ),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setProposal({
                        ...proposal,
                        steps: [
                          ...proposal.steps,
                          { action: '', expectedResult: '' },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add step
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="proposal-result">Expected result</Label>
                  <Textarea
                    id="proposal-result"
                    value={proposal.expectedResult}
                    onChange={(event) =>
                      setProposal({
                        ...proposal,
                        expectedResult: event.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {proposal && (
              <Button
                type="button"
                variant="ghost"
                onClick={generate}
                disabled={busy}
              >
                Regenerate
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {proposal && jobId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    await discardProposal.mutateAsync({ jobId });
                    onOpenChange(false);
                  }}
                >
                  {discardProposal.isPending ? 'Discarding…' : 'Discard'}
                </Button>
                <Button
                  type="button"
                  disabled={
                    busy ||
                    !proposal.title.trim() ||
                    !proposal.expectedResult.trim() ||
                    proposal.steps.some((step) => !step.action.trim())
                  }
                  onClick={() => acceptProposal.mutate({ jobId, proposal })}
                >
                  {acceptProposal.isPending
                    ? 'Accepting…'
                    : 'Accept and save version'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
