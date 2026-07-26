import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
} from 'lucide-react';

export function TestSuitePage() {
  const { projectId, productId, suiteId } = useParams<{
    projectId: string;
    productId: string;
    suiteId: string;
  }>();
  // Create Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTestCase, setNewTestCase] = useState({
    title: '',
    description: '',
    prerequisites: [] as string[],
    steps: [{ action: '', expectedResult: '' }],
    expectedResult: '',
    priority: 'medium' as const,
    status: 'draft' as const,
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  // Edit Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<{
    id: number;
    title: string;
    description: string;
    prerequisites: string[];
    steps: Array<{ action: string; expectedResult?: string }>;
    expectedResult: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'draft' | 'ready' | 'deprecated';
    tags: string[];
  } | null>(null);
  const [editTagInput, setEditTagInput] = useState('');

  const { data: suite, isLoading: isLoadingSuite } =
    trpc.testSuites.get.useQuery(
      { id: Number(suiteId) },
      { enabled: !!suiteId },
    );

  const { data: product, isLoading: isLoadingProduct } =
    trpc.products.get.useQuery(
      { id: Number(productId) },
      { enabled: !!productId },
    );

  const { data: project } = trpc.projects.get.useQuery(
    { id: Number(projectId) },
    { enabled: !!projectId },
  );

  const { data: testCases, isLoading: isLoadingCases } =
    trpc.testCases.list.useQuery(
      { suiteId: Number(suiteId) },
      { enabled: !!suiteId },
    );

  const utils = trpc.useContext();

  const createTestCase = trpc.testCases.create.useMutation({
    onSuccess: () => {
      utils.testCases.list.invalidate({ suiteId: Number(suiteId) });
      setIsCreateDialogOpen(false);
      setNewTestCase({
        title: '',
        description: '',
        prerequisites: [],
        steps: [{ action: '', expectedResult: '' }],
        expectedResult: '',
        priority: 'medium',
        status: 'draft',
        tags: [],
      });
    },
  });

  const updateTestCase = trpc.testCases.update.useMutation({
    onSuccess: () => {
      utils.testCases.list.invalidate({ suiteId: Number(suiteId) });
      setIsEditDialogOpen(false);
      setEditingTestCase(null);
    },
  });

  const deleteTestCase = trpc.testCases.delete.useMutation({
    onSuccess: () => {
      utils.testCases.list.invalidate({ suiteId: Number(suiteId) });
    },
  });

  // Create form handlers
  const handleAddStep = () => {
    setNewTestCase({
      ...newTestCase,
      steps: [...newTestCase.steps, { action: '', expectedResult: '' }],
    });
  };

  const handleRemoveStep = (index: number) => {
    setNewTestCase({
      ...newTestCase,
      steps: newTestCase.steps.filter((_, i) => i !== index),
    });
  };

  const handleStepChange = (
    index: number,
    field: 'action' | 'expectedResult',
    value: string,
  ) => {
    const newSteps = [...newTestCase.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setNewTestCase({ ...newTestCase, steps: newSteps });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !newTestCase.tags.includes(tagInput.trim())) {
      setNewTestCase({
        ...newTestCase,
        tags: [...newTestCase.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewTestCase({
      ...newTestCase,
      tags: newTestCase.tags.filter((t) => t !== tag),
    });
  };

  const handleCreateTestCase = (e: React.FormEvent) => {
    e.preventDefault();
    const filteredSteps = newTestCase.steps.filter((step) =>
      step.action.trim(),
    );
    if (
      newTestCase.title.trim() &&
      newTestCase.expectedResult.trim() &&
      filteredSteps.length > 0
    ) {
      createTestCase.mutate({
        suiteId: Number(suiteId),
        title: newTestCase.title,
        description: newTestCase.description || undefined,
        prerequisites: newTestCase.prerequisites.filter((value) =>
          value.trim(),
        ),
        steps: filteredSteps,
        expectedResult: newTestCase.expectedResult,
        priority: newTestCase.priority,
        status: newTestCase.status,
        tags: newTestCase.tags,
      });
    }
  };

  // Edit form handlers
  const openEditDialog = (testCase: NonNullable<typeof testCases>[number]) => {
    const currentVersion = testCase.currentVersion || testCase.versions?.[0];
    if (!currentVersion) return;

    setEditingTestCase({
      id: testCase.id,
      title: currentVersion.title,
      description: currentVersion.description || '',
      prerequisites: currentVersion.prerequisites,
      steps:
        currentVersion.steps.length > 0
          ? currentVersion.steps
          : [{ action: '', expectedResult: '' }],
      expectedResult: currentVersion.expectedResult,
      priority: currentVersion.priority,
      status: currentVersion.status,
      tags: currentVersion.tags,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditAddStep = () => {
    if (editingTestCase) {
      setEditingTestCase({
        ...editingTestCase,
        steps: [...editingTestCase.steps, { action: '', expectedResult: '' }],
      });
    }
  };

  const handleEditRemoveStep = (index: number) => {
    if (editingTestCase) {
      setEditingTestCase({
        ...editingTestCase,
        steps: editingTestCase.steps.filter((_, i) => i !== index),
      });
    }
  };

  const handleEditStepChange = (
    index: number,
    field: 'action' | 'expectedResult',
    value: string,
  ) => {
    if (editingTestCase) {
      const newSteps = [...editingTestCase.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      setEditingTestCase({ ...editingTestCase, steps: newSteps });
    }
  };

  const handleEditAddTag = () => {
    if (
      editTagInput.trim() &&
      editingTestCase &&
      !editingTestCase.tags.includes(editTagInput.trim())
    ) {
      setEditingTestCase({
        ...editingTestCase,
        tags: [...editingTestCase.tags, editTagInput.trim()],
      });
      setEditTagInput('');
    }
  };

  const handleEditRemoveTag = (tag: string) => {
    if (editingTestCase) {
      setEditingTestCase({
        ...editingTestCase,
        tags: editingTestCase.tags.filter((t) => t !== tag),
      });
    }
  };

  const handleUpdateTestCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      editingTestCase &&
      editingTestCase.title.trim() &&
      editingTestCase.expectedResult.trim()
    ) {
      const filteredSteps = editingTestCase.steps.filter((step) =>
        step.action.trim(),
      );
      if (filteredSteps.length > 0) {
        updateTestCase.mutate({
          id: editingTestCase.id,
          title: editingTestCase.title,
          description: editingTestCase.description || undefined,
          prerequisites: editingTestCase.prerequisites.filter((value) =>
            value.trim(),
          ),
          steps: filteredSteps,
          expectedResult: editingTestCase.expectedResult,
          priority: editingTestCase.priority,
          status: editingTestCase.status,
          tags: editingTestCase.tags,
        });
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'deprecated':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoadingSuite || isLoadingProduct) {
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

  if (!suite) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Test Suite not found</h2>
        <Button className="mt-4" asChild>
          <Link to={`/projects/${projectId}/products/${productId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Product
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
            <Link to="/" className="hover:text-foreground">
              Projects
            </Link>
            <span>/</span>
            <Link
              to={`/projects/${projectId}`}
              className="hover:text-foreground"
            >
              {project?.name || 'Project'}
            </Link>
            <span>/</span>
            <Link
              to={`/projects/${projectId}/products/${productId}`}
              className="hover:text-foreground"
            >
              {product?.name || 'Product'}
            </Link>
            <span>/</span>
            <span>Test Suite</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{suite.name}</h1>
          {product && (
            <p className="text-sm text-muted-foreground">{product.name}</p>
          )}
          {suite.description && (
            <p className="text-muted-foreground max-w-2xl">
              {suite.description}
            </p>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline">
              Version {suite.versions?.[0]?.versionNumber || 1}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {testCases?.length || 0} test cases
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}/products/${productId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Test Case
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateTestCase}>
                <DialogHeader>
                  <DialogTitle>Create Test Case</DialogTitle>
                  <DialogDescription>
                    Add a new test case to this suite. Each edit creates a new
                    version.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Test case title"
                      value={newTestCase.title}
                      onChange={(e) =>
                        setNewTestCase({
                          ...newTestCase,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of what this test covers..."
                      value={newTestCase.description}
                      onChange={(e) =>
                        setNewTestCase({
                          ...newTestCase,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Priority</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={newTestCase.priority}
                        onChange={(e) =>
                          setNewTestCase({
                            ...newTestCase,
                            priority: e.target.value as any,
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
                      <Label>Status</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={newTestCase.status}
                        onChange={(e) =>
                          setNewTestCase({
                            ...newTestCase,
                            status: e.target.value as any,
                          })
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="ready">Ready</option>
                        <option value="deprecated">Deprecated</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="prerequisites">Prerequisites</Label>
                    <Textarea
                      id="prerequisites"
                      placeholder="One prerequisite per line"
                      value={newTestCase.prerequisites.join('\n')}
                      onChange={(e) =>
                        setNewTestCase({
                          ...newTestCase,
                          prerequisites: e.target.value.split('\n'),
                        })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Steps</Label>
                    <div className="space-y-2">
                      {newTestCase.steps.map((step, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-medium">
                            {index + 1}
                          </span>
                          <div className="grid flex-1 gap-2">
                            <Input
                              placeholder="Action"
                              value={step.action}
                              onChange={(e) =>
                                handleStepChange(
                                  index,
                                  'action',
                                  e.target.value,
                                )
                              }
                            />
                            <Input
                              placeholder="Expected result for this step (optional)"
                              value={step.expectedResult || ''}
                              onChange={(e) =>
                                handleStepChange(
                                  index,
                                  'expectedResult',
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          {newTestCase.steps.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleRemoveStep(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddStep}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Step
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="expectedResult">Expected Result</Label>
                    <Textarea
                      id="expectedResult"
                      placeholder="What should happen when these steps are executed?"
                      value={newTestCase.expectedResult}
                      onChange={(e) =>
                        setNewTestCase({
                          ...newTestCase,
                          expectedResult: e.target.value,
                        })
                      }
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddTag}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newTestCase.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createTestCase.isPending ||
                      !newTestCase.title.trim() ||
                      !newTestCase.expectedResult.trim() ||
                      newTestCase.steps.filter((step) => step.action.trim())
                        .length === 0
                    }
                  >
                    {createTestCase.isPending
                      ? 'Creating...'
                      : 'Create Test Case'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleUpdateTestCase}>
            <DialogHeader>
              <DialogTitle>Edit Test Case</DialogTitle>
              <DialogDescription>
                Update test case details. Changes will create a new version.
              </DialogDescription>
            </DialogHeader>
            {editingTestCase && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    placeholder="Test case title"
                    value={editingTestCase.title}
                    onChange={(e) =>
                      setEditingTestCase({
                        ...editingTestCase,
                        title: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Brief description of what this test covers..."
                    value={editingTestCase.description}
                    onChange={(e) =>
                      setEditingTestCase({
                        ...editingTestCase,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={editingTestCase.priority}
                      onChange={(e) =>
                        setEditingTestCase({
                          ...editingTestCase,
                          priority: e.target.value as any,
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
                    <Label>Status</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={editingTestCase.status}
                      onChange={(e) =>
                        setEditingTestCase({
                          ...editingTestCase,
                          status: e.target.value as any,
                        })
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-prerequisites">Prerequisites</Label>
                  <Textarea
                    id="edit-prerequisites"
                    placeholder="One prerequisite per line"
                    value={editingTestCase.prerequisites.join('\n')}
                    onChange={(e) =>
                      setEditingTestCase({
                        ...editingTestCase,
                        prerequisites: e.target.value.split('\n'),
                      })
                    }
                    rows={3}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Steps</Label>
                  <div className="space-y-2">
                    {editingTestCase.steps.map((step, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-medium">
                          {index + 1}
                        </span>
                        <div className="grid flex-1 gap-2">
                          <Input
                            placeholder="Action"
                            value={step.action}
                            onChange={(e) =>
                              handleEditStepChange(
                                index,
                                'action',
                                e.target.value,
                              )
                            }
                          />
                          <Input
                            placeholder="Expected result for this step (optional)"
                            value={step.expectedResult || ''}
                            onChange={(e) =>
                              handleEditStepChange(
                                index,
                                'expectedResult',
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        {editingTestCase.steps.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditRemoveStep(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleEditAddStep}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Step
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-expectedResult">Expected Result</Label>
                  <Textarea
                    id="edit-expectedResult"
                    placeholder="What should happen when these steps are executed?"
                    value={editingTestCase.expectedResult}
                    onChange={(e) =>
                      setEditingTestCase({
                        ...editingTestCase,
                        expectedResult: e.target.value,
                      })
                    }
                    rows={3}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag..."
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleEditAddTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleEditAddTag}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editingTestCase.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleEditRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  updateTestCase.isPending ||
                  !editingTestCase?.title.trim() ||
                  !editingTestCase?.expectedResult.trim() ||
                  (editingTestCase?.steps.filter((step) => step.action.trim())
                    .length || 0) === 0
                }
              >
                {updateTestCase.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Test Cases */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Test Cases</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoadingCases ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : testCases && testCases.length > 0 ? (
            <div className="space-y-4">
              {testCases.map((testCase) => {
                const currentVersion =
                  testCase.currentVersion || testCase.versions?.[0];
                if (!currentVersion) return null;

                return (
                  <Card key={testCase.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {currentVersion.title}
                            </CardTitle>
                            <Badge
                              className={getPriorityColor(
                                currentVersion.priority,
                              )}
                            >
                              {currentVersion.priority}
                            </Badge>
                            {getStatusIcon(currentVersion.status)}
                          </div>
                          {currentVersion.description && (
                            <CardDescription>
                              {currentVersion.description}
                            </CardDescription>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(testCase)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                deleteTestCase.mutate({ id: testCase.id })
                              }
                              className="text-destructive focus:text-destructive"
                              disabled={deleteTestCase.isPending}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {currentVersion.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {currentVersion.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {currentVersion.prerequisites.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Prerequisites:
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                              {currentVersion.prerequisites.map(
                                (prerequisite, idx) => (
                                  <li key={idx}>{prerequisite}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Steps:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                            {currentVersion.steps.map((step, idx) => (
                              <li key={idx}>
                                {step.action}
                                {step.expectedResult && (
                                  <div className="ml-5 text-xs">
                                    Expected: {step.expectedResult}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                        {currentVersion.expectedResult && (
                          <div>
                            <h4 className="text-sm font-medium mb-1">
                              Expected Result:
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {currentVersion.expectedResult}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8">
              <div className="text-center space-y-3">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No test cases yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Create your first test case to start documenting your tests.
                  Each test case can have multiple steps and versions.
                </p>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Test Case
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
