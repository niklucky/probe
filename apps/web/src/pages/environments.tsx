import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Cookie,
  Edit,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react';
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

const emptyVariableForm = {
  key: '',
  value: '',
  isSecret: false,
  description: '',
};

type CookieSameSite = 'Strict' | 'Lax' | 'None';

const emptyCookieForm = {
  name: '',
  valueTemplate: '',
  domain: '',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as CookieSameSite,
  expiresAt: '',
  enabled: true,
};

export function EnvironmentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const [productId, setProductId] = useState<number | undefined>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [variablesEnvironment, setVariablesEnvironment] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [editingVariableId, setEditingVariableId] = useState<number | null>(
    null,
  );
  const [editingVariableWasSecret, setEditingVariableWasSecret] =
    useState(false);
  const [variableForm, setVariableForm] = useState(emptyVariableForm);
  const [variableError, setVariableError] = useState('');
  const [cookiesEnvironment, setCookiesEnvironment] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [editingCookieId, setEditingCookieId] = useState<number | null>(null);
  const [cookieForm, setCookieForm] = useState(emptyCookieForm);
  const [cookieError, setCookieError] = useState('');
  const input = { projectId: id, productId };

  const { data: project } = trpc.projects.get.useQuery({ id });
  const { data: products } = trpc.products.list.useQuery({ projectId: id });
  const { data: environments } = trpc.environments.list.useQuery(input);
  const variablesInput = {
    environmentId: variablesEnvironment?.id ?? 0,
  };
  const { data: variables = [] } = trpc.environments.listVariables.useQuery(
    variablesInput,
    { enabled: Boolean(variablesEnvironment) },
  );
  const cookiesInput = { environmentId: cookiesEnvironment?.id ?? 0 };
  const { data: cookies = [] } = trpc.environments.listCookies.useQuery(
    cookiesInput,
    { enabled: Boolean(cookiesEnvironment) },
  );
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
  const refreshVariables = () =>
    utils.environments.listVariables.invalidate(variablesInput);
  const createVariable = trpc.environments.createVariable.useMutation({
    onSuccess: () => {
      refreshVariables();
      setVariableForm(emptyVariableForm);
      setVariableError('');
    },
    onError: (error) => setVariableError(error.message),
  });
  const updateVariable = trpc.environments.updateVariable.useMutation({
    onSuccess: () => {
      refreshVariables();
      setEditingVariableId(null);
      setEditingVariableWasSecret(false);
      setVariableForm(emptyVariableForm);
      setVariableError('');
    },
    onError: (error) => setVariableError(error.message),
  });
  const deleteVariable = trpc.environments.deleteVariable.useMutation({
    onSuccess: refreshVariables,
    onError: (error) => setVariableError(error.message),
  });
  const refreshCookies = () =>
    utils.environments.listCookies.invalidate(cookiesInput);
  const resetCookieEditor = () => {
    setEditingCookieId(null);
    setCookieForm(emptyCookieForm);
    setCookieError('');
  };
  const createCookie = trpc.environments.createCookie.useMutation({
    onSuccess: () => {
      refreshCookies();
      resetCookieEditor();
    },
    onError: (error) => setCookieError(error.message),
  });
  const updateCookie = trpc.environments.updateCookie.useMutation({
    onSuccess: () => {
      refreshCookies();
      resetCookieEditor();
    },
    onError: (error) => setCookieError(error.message),
  });
  const deleteCookie = trpc.environments.deleteCookie.useMutation({
    onSuccess: refreshCookies,
    onError: (error) => setCookieError(error.message),
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

  const submitVariable = (event: React.FormEvent) => {
    event.preventDefault();
    if (!variablesEnvironment) return;
    if (editingVariableId) {
      updateVariable.mutate({
        id: editingVariableId,
        key: variableForm.key,
        isSecret: variableForm.isSecret,
        description: variableForm.description || null,
        ...(!editingVariableWasSecret || variableForm.value !== ''
          ? { value: variableForm.value }
          : {}),
      });
      return;
    }
    createVariable.mutate({
      environmentId: variablesEnvironment.id,
      ...variableForm,
      description: variableForm.description || undefined,
    });
  };

  const submitCookie = (event: React.FormEvent) => {
    event.preventDefault();
    if (!cookiesEnvironment) return;
    const values = {
      ...cookieForm,
      domain: cookieForm.domain || null,
      expiresAt: cookieForm.expiresAt ? new Date(cookieForm.expiresAt) : null,
    };
    if (editingCookieId) {
      updateCookie.mutate({ id: editingCookieId, ...values });
    } else {
      createCookie.mutate({ environmentId: cookiesEnvironment.id, ...values });
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
            Base URLs and encrypted variables for reusable test placeholders.
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
              <div className="flex items-center justify-between gap-3">
                <a
                  className="truncate text-sm text-primary hover:underline"
                  href={environment.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {environment.baseUrl}
                </a>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVariablesEnvironment({
                        id: environment.id,
                        name: environment.name,
                      });
                      setEditingVariableId(null);
                      setVariableForm(emptyVariableForm);
                      setVariableError('');
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Variables
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCookiesEnvironment({
                        id: environment.id,
                        name: environment.name,
                      });
                      resetCookieEditor();
                    }}
                  >
                    <Cookie className="mr-2 h-4 w-4" />
                    Cookies
                  </Button>
                </div>
              </div>
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

      <Dialog
        open={variablesEnvironment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVariablesEnvironment(null);
            setEditingVariableId(null);
            setEditingVariableWasSecret(false);
            setVariableForm(emptyVariableForm);
            setVariableError('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{variablesEnvironment?.name} variables</DialogTitle>
            <DialogDescription>
              Reference values in test text as{' '}
              <code>{'{{variable_name}}'}</code>. All values are encrypted at
              rest; secret values cannot be read back.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitVariable}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="variable-key">Key</Label>
                <Input
                  id="variable-key"
                  value={variableForm.key}
                  onChange={(event) =>
                    setVariableForm({
                      ...variableForm,
                      key: event.target.value,
                    })
                  }
                  placeholder="username"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="variable-value">Value</Label>
                <Input
                  id="variable-value"
                  type={variableForm.isSecret ? 'password' : 'text'}
                  value={variableForm.value}
                  onChange={(event) =>
                    setVariableForm({
                      ...variableForm,
                      value: event.target.value,
                    })
                  }
                  placeholder={
                    editingVariableWasSecret
                      ? 'Leave blank to keep the existing value'
                      : 'Value'
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variable-description">Description</Label>
              <Input
                id="variable-description"
                value={variableForm.description}
                onChange={(event) =>
                  setVariableForm({
                    ...variableForm,
                    description: event.target.value,
                  })
                }
                placeholder="QA account username"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="variable-secret"
                  checked={variableForm.isSecret}
                  onCheckedChange={(checked) =>
                    setVariableForm({
                      ...variableForm,
                      isSecret: checked === true,
                    })
                  }
                />
                <Label htmlFor="variable-secret">Secret value</Label>
              </div>
              <div className="flex gap-2">
                {editingVariableId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingVariableId(null);
                      setEditingVariableWasSecret(false);
                      setVariableForm(emptyVariableForm);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={
                    createVariable.isPending || updateVariable.isPending
                  }
                >
                  {editingVariableId ? 'Save variable' : 'Add variable'}
                </Button>
              </div>
            </div>
          </form>

          {variableError && (
            <p className="text-sm text-destructive">{variableError}</p>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {variables.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No variables configured yet.
              </p>
            )}
            {variables.map((variable) => (
              <div
                key={variable.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="font-medium">{`{{${variable.key}}}`}</code>
                    {variable.isSecret && (
                      <Badge variant="secondary">Secret</Badge>
                    )}
                    {variable.valueStatus === 'unreadable' && (
                      <Badge variant="destructive">Unavailable</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {variable.isSecret
                      ? '••••••••'
                      : variable.valueStatus === 'unreadable'
                        ? 'Value cannot be decrypted'
                        : variable.value}
                    {variable.description ? ` · ${variable.description}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingVariableId(variable.id);
                      setEditingVariableWasSecret(variable.isSecret);
                      setVariableForm({
                        key: variable.key,
                        value: variable.value ?? '',
                        isSecret: variable.isSecret,
                        description: variable.description ?? '',
                      });
                      setVariableError('');
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteVariable.mutate({ id: variable.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cookiesEnvironment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCookiesEnvironment(null);
            resetCookieEditor();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{cookiesEnvironment?.name} cookies</DialogTitle>
            <DialogDescription>
              Cookie values are templates such as{' '}
              <code>{'{{session_id}}'}</code>. Resolved values are never stored
              or returned by the API.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitCookie}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cookie-name">Name</Label>
                <Input
                  id="cookie-name"
                  value={cookieForm.name}
                  onChange={(event) =>
                    setCookieForm({ ...cookieForm, name: event.target.value })
                  }
                  placeholder="session_id"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cookie-value">Value template</Label>
                <Input
                  id="cookie-value"
                  value={cookieForm.valueTemplate}
                  onChange={(event) =>
                    setCookieForm({
                      ...cookieForm,
                      valueTemplate: event.target.value,
                    })
                  }
                  placeholder="{{session_id}}"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cookie-domain">Domain (optional)</Label>
                <Input
                  id="cookie-domain"
                  value={cookieForm.domain}
                  onChange={(event) =>
                    setCookieForm({ ...cookieForm, domain: event.target.value })
                  }
                  placeholder="Defaults to the environment host"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cookie-path">Path</Label>
                <Input
                  id="cookie-path"
                  value={cookieForm.path}
                  onChange={(event) =>
                    setCookieForm({ ...cookieForm, path: event.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cookie-same-site">SameSite</Label>
                <select
                  id="cookie-same-site"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={cookieForm.sameSite}
                  onChange={(event) =>
                    setCookieForm({
                      ...cookieForm,
                      sameSite: event.target.value as CookieSameSite,
                    })
                  }
                >
                  <option value="Strict">Strict</option>
                  <option value="Lax">Lax</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cookie-expiry">Expiry (optional)</Label>
                <Input
                  id="cookie-expiry"
                  type="datetime-local"
                  value={cookieForm.expiresAt}
                  onChange={(event) =>
                    setCookieForm({
                      ...cookieForm,
                      expiresAt: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {(
                [
                  ['cookie-http-only', 'httpOnly', 'HTTP only'],
                  ['cookie-secure', 'secure', 'Secure'],
                  ['cookie-enabled', 'enabled', 'Enabled'],
                ] as const
              ).map(([id, field, label]) => (
                <div key={field} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={cookieForm[field]}
                    onCheckedChange={(checked) =>
                      setCookieForm({
                        ...cookieForm,
                        [field]: checked === true,
                      })
                    }
                  />
                  <Label htmlFor={id}>{label}</Label>
                </div>
              ))}
              <div className="ml-auto flex gap-2">
                {editingCookieId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetCookieEditor}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createCookie.isPending || updateCookie.isPending}
                >
                  {editingCookieId ? 'Save cookie' : 'Add cookie'}
                </Button>
              </div>
            </div>
          </form>

          {cookieError && (
            <p className="text-sm text-destructive">{cookieError}</p>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {cookies.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No cookies configured yet.
              </p>
            )}
            {cookies.map((cookie) => (
              <div
                key={cookie.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="font-medium">{cookie.name}</code>
                    {!cookie.enabled && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                    {cookie.httpOnly && (
                      <Badge variant="secondary">HTTP only</Badge>
                    )}
                    {cookie.secure && <Badge variant="secondary">Secure</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {cookie.valueTemplate} ·{' '}
                    {cookie.domain ?? 'environment host'}
                    {cookie.path} · SameSite={cookie.sameSite}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingCookieId(cookie.id);
                      setCookieForm({
                        name: cookie.name,
                        valueTemplate: cookie.valueTemplate,
                        domain: cookie.domain ?? '',
                        path: cookie.path,
                        httpOnly: cookie.httpOnly,
                        secure: cookie.secure,
                        sameSite: cookie.sameSite,
                        expiresAt: cookie.expiresAt
                          ? new Date(cookie.expiresAt)
                              .toISOString()
                              .slice(0, 16)
                          : '',
                        enabled: cookie.enabled,
                      });
                      setCookieError('');
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCookie.mutate({ id: cookie.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
