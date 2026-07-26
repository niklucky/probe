import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Edit, Plus, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

type EnvironmentType =
  'local' | 'development' | 'staging' | 'production' | 'custom';

const emptyForm = {
  name: '',
  type: 'development' as EnvironmentType,
  baseUrl: '',
  isDefault: false,
};

export function EnvironmentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const [productId, setProductId] = useState<number | undefined>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const input = { projectId: id, productId };

  const { data: project } = trpc.projects.get.useQuery({ id });
  const { data: products } = trpc.products.list.useQuery({ projectId: id });
  const { data: environments } = trpc.environments.list.useQuery(input);
  const utils = trpc.useContext();

  const refresh = () => utils.environments.list.invalidate(input);
  const createEnvironment = trpc.environments.create.useMutation({
    onSuccess: () => {
      refresh();
      setIsCreateOpen(false);
      setForm(emptyForm);
    },
  });
  const updateEnvironment = trpc.environments.update.useMutation({
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setForm(emptyForm);
    },
  });
  const deleteEnvironment = trpc.environments.delete.useMutation({
    onSuccess: refresh,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId) {
      updateEnvironment.mutate({ id: editingId, ...form });
    } else {
      createEnvironment.mutate({
        projectId: id,
        productId,
        ...form,
      });
    }
  };

  const formFields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="environment-name">Name</Label>
        <Input
          id="environment-name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Staging"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="environment-type">Type</Label>
        <select
          id="environment-type"
          className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={form.type}
          onChange={(event) =>
            setForm({ ...form, type: event.target.value as EnvironmentType })
          }
        >
          <option value="local">Local</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="environment-url">Base URL</Label>
        <Input
          id="environment-url"
          type="url"
          value={form.baseUrl}
          onChange={(event) =>
            setForm({ ...form, baseUrl: event.target.value })
          }
          placeholder="https://staging.example.com"
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="environment-default"
          checked={form.isDefault}
          onCheckedChange={(checked) =>
            setForm({ ...form, isDefault: checked === true })
          }
        />
        <Label htmlFor="environment-default">Default for this scope</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Link to={`/projects/${projectId}`}>
              {project?.name || 'Project'}
            </Link>
            <span>/</span>
            <span>Environments</span>
          </div>
          <h1 className="text-3xl font-bold">Environments</h1>
          <p className="text-muted-foreground">
            Base URLs only. Store test credentials in a secret store, not test
            cases or environment records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(emptyForm)}>
                <Plus className="mr-2 h-4 w-4" />
                Add environment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>Add environment</DialogTitle>
                  <DialogDescription>
                    This environment will belong to the selected scope.
                  </DialogDescription>
                </DialogHeader>
                {formFields}
                <DialogFooter>
                  <Button type="submit" disabled={createEnvironment.isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>
            Choose project-wide environments or a specific product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-sm"
            value={productId ?? ''}
            onChange={(event) =>
              setProductId(
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
          >
            <option value="">Project-wide</option>
            {products?.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {environments?.map((environment) => (
          <Card key={environment.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {environment.name}
                  {environment.isDefault && (
                    <Badge>
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Default
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{environment.type}</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingId(environment.id);
                    setForm({
                      name: environment.name,
                      type: environment.type,
                      baseUrl: environment.baseUrl,
                      isDefault: environment.isDefault,
                    });
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    deleteEnvironment.mutate({ id: environment.id })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <a
                className="text-sm text-primary hover:underline"
                href={environment.baseUrl}
                target="_blank"
                rel="noreferrer"
              >
                {environment.baseUrl}
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editingId !== null} onOpenChange={() => setEditingId(null)}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Edit environment</DialogTitle>
            </DialogHeader>
            {formFields}
            <DialogFooter>
              <Button type="submit" disabled={updateEnvironment.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
