import { useState } from 'react';
import { useParams } from 'react-router-dom';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Package, 
  Users, 
  Play,
  Settings,
  ArrowLeft,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);

  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { id },
    { enabled: !!id }
  );

  const { data: products } = trpc.products.list.useQuery(
    { projectId: id },
    { enabled: !!id }
  );

  const { data: teams } = trpc.teams.list.useQuery(
    { projectId: id },
    { enabled: !!id }
  );

  const { data: testRuns } = trpc.testRuns.list.useQuery(
    { projectId: id },
    { enabled: !!id }
  );

  // Create Product Dialog State
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    type: 'website' as const,
    description: '',
  });

  // Edit Product Dialog State
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{
    id: number;
    name: string;
    type: 'website' | 'mobile_app' | 'server' | 'api' | 'desktop_app' | 'other';
    description: string | null;
  } | null>(null);

  const utils = trpc.useContext();

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate({ projectId: id });
      setIsCreateProductOpen(false);
      setNewProduct({ name: '', type: 'website', description: '' });
    },
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate({ projectId: id });
      setIsEditProductOpen(false);
      setEditingProduct(null);
    },
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate({ projectId: id });
    },
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProduct.name.trim()) {
      createProduct.mutate({
        projectId: id,
        name: newProduct.name,
        type: newProduct.type,
        description: newProduct.description || undefined,
      });
    }
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct && editingProduct.name.trim()) {
      updateProduct.mutate({
        id: editingProduct.id,
        name: editingProduct.name,
        type: editingProduct.type,
        description: editingProduct.description || undefined,
      });
    }
  };

  const openEditProductDialog = (product: NonNullable<typeof products>[number]) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      type: product.type,
      description: product.description,
    });
    setIsEditProductOpen(true);
  };

  if (isLoadingProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
        <p className="text-muted-foreground mt-2">
          The project you're looking for doesn't exist or you don't have access to it.
        </p>
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
            <span>{project.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground max-w-2xl">{project.description}</p>
          )}
        </div>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teams?.reduce((acc, team) => acc + (team.members?.length || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
          </CardContent>
        </Card>
        <Link to={`/projects/${projectId}/runs`}>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Test Runs</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{testRuns?.length || 0}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Create Product Dialog */}
      <Dialog open={isCreateProductOpen} onOpenChange={setIsCreateProductOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreateProduct}>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
              <DialogDescription>
                Add a new product to this project (website, mobile app, API, etc.)
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="product-name">Product Name</Label>
                <Input
                  id="product-name"
                  placeholder="e.g., Main Website"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-type">Product Type</Label>
                <select
                  id="product-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={newProduct.type}
                  onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value as any })}
                >
                  <option value="website">Website</option>
                  <option value="mobile_app">Mobile App</option>
                  <option value="server">Server</option>
                  <option value="api">API</option>
                  <option value="desktop_app">Desktop App</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-description">Description</Label>
                <Textarea
                  id="product-description"
                  placeholder="Brief description of this product..."
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateProductOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProduct.isPending || !newProduct.name.trim()}>
                {createProduct.isPending ? 'Adding...' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdateProduct}>
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update the product details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-product-name">Product Name</Label>
                <Input
                  id="edit-product-name"
                  placeholder="e.g., Main Website"
                  value={editingProduct?.name || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, name: e.target.value } : null)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-product-type">Product Type</Label>
                <select
                  id="edit-product-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={editingProduct?.type || 'website'}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, type: e.target.value as any } : null)}
                >
                  <option value="website">Website</option>
                  <option value="mobile_app">Mobile App</option>
                  <option value="server">Server</option>
                  <option value="api">API</option>
                  <option value="desktop_app">Desktop App</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-product-description">Description</Label>
                <Textarea
                  id="edit-product-description"
                  placeholder="Brief description of this product..."
                  value={editingProduct?.description || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditProductOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProduct.isPending || !editingProduct?.name.trim()}>
                {updateProduct.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates and changes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {products && products.length > 0 ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    asChild
                  >
                    <Link to={`/projects/${projectId}/products/${products[0].id}`}>
                      <Package className="mr-2 h-4 w-4" />
                      View First Product
                    </Link>
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Add a product first to view details
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setIsCreateProductOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Invite Team Member
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Products</h3>
            <Button size="sm" onClick={() => setIsCreateProductOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
          {products && products.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {products.map((product) => (
                <Card key={product.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{product.name}</CardTitle>
                          <Badge variant="secondary">{product.type}</Badge>
                        </div>
                        {product.description && (
                          <CardDescription className="line-clamp-2">{product.description}</CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditProductDialog(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteProduct.mutate({ id: product.id })}
                            className="text-destructive focus:text-destructive"
                            disabled={deleteProduct.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/projects/${projectId}/products/${product.id}`}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        View Product
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8">
              <div className="text-center space-y-3">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No products yet</h3>
                <p className="text-sm text-muted-foreground">
                  Add products to track what you're testing (websites, mobile apps, APIs, etc.)
                </p>
                <Button onClick={() => setIsCreateProductOpen(true)} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Teams</h3>
            <Button size="sm" asChild>
              <Link to={`/projects/${projectId}/teams`}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Teams
              </Link>
            </Button>
          </div>
          {teams && teams.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {teams.map((team) => (
                <Card key={team.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{team.name}</CardTitle>
                        <CardDescription>
                          {team.members?.length || 0} member{team.members?.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {team.members && team.members.length > 0 && (
                      <div className="flex -space-x-2 mb-3">
                        {team.members.slice(0, 5).map((member) => (
                          <Avatar
                            key={member.id}
                            className="h-8 w-8 border-2 border-background"
                            title={member.user?.name}
                          >
                            {member.user?.avatarUrl && (
                              <AvatarImage src={member.user.avatarUrl} alt={member.user.name} />
                            )}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {member.user?.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {team.members.length > 5 && (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                            +{team.members.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/projects/${projectId}/teams`}>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Members
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8">
              <div className="text-center space-y-3">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No teams yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create teams to organize members and assign roles
                </p>
                <Button className="mt-4" asChild>
                  <Link to={`/projects/${projectId}/teams`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Team
                  </Link>
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
