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
import { 
  ArrowLeft, 
  Plus, 
  LayoutGrid,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle
} from 'lucide-react';

export function ProductPage() {
  const { projectId, productId } = useParams<{ projectId: string; productId: string }>();
  const id = Number(productId);
  const projId = Number(projectId);

  const { data: product, isLoading: isLoadingProduct } = trpc.products.get.useQuery(
    { id },
    { enabled: !!id }
  );

  const { data: project } = trpc.projects.get.useQuery(
    { id: projId },
    { enabled: !!projId }
  );

  const { data: testSuites } = trpc.testSuites.list.useQuery(
    { productId: id },
    { enabled: !!id }
  );

  // Create Test Suite Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSuite, setNewSuite] = useState({ name: '', description: '' });

  // Edit Test Suite Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<{ id: number; name: string; description: string | null } | null>(null);

  const utils = trpc.useContext();

  const createSuite = trpc.testSuites.create.useMutation({
    onSuccess: () => {
      utils.testSuites.list.invalidate({ productId: id });
      setIsCreateDialogOpen(false);
      setNewSuite({ name: '', description: '' });
    },
  });

  const updateSuite = trpc.testSuites.update.useMutation({
    onSuccess: () => {
      utils.testSuites.list.invalidate({ productId: id });
      setIsEditDialogOpen(false);
      setEditingSuite(null);
    },
  });

  const deleteSuite = trpc.testSuites.delete.useMutation({
    onSuccess: () => {
      utils.testSuites.list.invalidate({ productId: id });
    },
  });

  const handleCreateSuite = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSuite.name.trim()) {
      createSuite.mutate({
        productId: id,
        name: newSuite.name,
        description: newSuite.description || undefined,
      });
    }
  };

  const handleUpdateSuite = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSuite && editingSuite.name.trim()) {
      updateSuite.mutate({
        id: editingSuite.id,
        name: editingSuite.name,
        description: editingSuite.description || undefined,
      });
    }
  };

  const openEditDialog = (suite: NonNullable<typeof testSuites>[number]) => {
    setEditingSuite({
      id: suite.id,
      name: suite.name,
      description: suite.description,
    });
    setIsEditDialogOpen(true);
  };

  if (isLoadingProduct) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Product not found</h2>
        <Button className="mt-4" asChild>
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
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
            <Link to={`/projects/${projectId}`} className="hover:text-foreground">{project?.name || 'Project'}</Link>
            <span>/</span>
            <span>{product.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          {product.description && (
            <p className="text-muted-foreground max-w-2xl">{product.description}</p>
          )}
          <Badge variant="secondary" className="mt-2">{product.type}</Badge>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
      </div>

      {/* Test Suites Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Test Suites</h2>
            <p className="text-sm text-muted-foreground">
              {testSuites?.length || 0} test suites
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Suite
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateSuite}>
                <DialogHeader>
                  <DialogTitle>Create Test Suite</DialogTitle>
                  <DialogDescription>
                    Create a new test suite for {product.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="suite-name">Suite Name</Label>
                    <Input
                      id="suite-name"
                      placeholder="e.g., Authentication Tests"
                      value={newSuite.name}
                      onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="suite-description">Description</Label>
                    <Textarea
                      id="suite-description"
                      placeholder="Brief description of what this suite covers..."
                      value={newSuite.description}
                      onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSuite.isPending || !newSuite.name.trim()}>
                    {createSuite.isPending ? 'Creating...' : 'Create Suite'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleUpdateSuite}>
              <DialogHeader>
                <DialogTitle>Edit Test Suite</DialogTitle>
                <DialogDescription>
                  Update the test suite details. Changes will create a new version.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-suite-name">Suite Name</Label>
                  <Input
                    id="edit-suite-name"
                    placeholder="e.g., Authentication Tests"
                    value={editingSuite?.name || ''}
                    onChange={(e) => setEditingSuite(prev => prev ? { ...prev, name: e.target.value } : null)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-suite-description">Description</Label>
                  <Textarea
                    id="edit-suite-description"
                    placeholder="Brief description of what this suite covers..."
                    value={editingSuite?.description || ''}
                    onChange={(e) => setEditingSuite(prev => prev ? { ...prev, description: e.target.value } : null)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSuite.isPending || !editingSuite?.name.trim()}>
                  {updateSuite.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {testSuites && testSuites.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {testSuites.map((suite) => (
              <Card key={suite.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{suite.name}</CardTitle>
                      {suite.description && (
                        <CardDescription className="line-clamp-2">{suite.description}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(suite)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteSuite.mutate({ id: suite.id })}
                          className="text-destructive focus:text-destructive"
                          disabled={deleteSuite.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant="outline" className="text-xs">
                      Version {suite.versions?.[0]?.versionNumber || 1}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to={`/projects/${projectId}/products/${productId}/suites/${suite.id}`}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      View Test Cases
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8">
            <div className="text-center space-y-3">
              <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No test suites yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Create test suites to organize your test cases for {product.name}.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Suite
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
