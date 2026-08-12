import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Braces,
  CheckCircle,
  Cookie,
  Edit,
  KeyRound,
  Plus,
  ShieldCheck,
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
  testIdAttribute: 'data-testid',
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

const emptyHeaderForm = (origin = '') => ({
  name: '',
  valueTemplate: '',
  origin,
  enabled: true,
});

const emptyProfileForm = {
  name: '',
  description: '',
  mode: 'basic' as 'basic' | 'advanced',
  enabled: true,
  variableIds: [] as number[],
  cookieIds: [] as number[],
  headerIds: [] as number[],
};

function formatDateTimeLocal(value: string | Date) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EnvironmentsPage() {
  const { projectId, productId: productIdParam } = useParams<{
    projectId: string;
    productId: string;
  }>();
  const productId = Number(productIdParam);
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
  const [headersEnvironment, setHeadersEnvironment] = useState<{
    id: number;
    name: string;
    baseOrigin: string;
  } | null>(null);
  const [editingHeaderId, setEditingHeaderId] = useState<number | null>(null);
  const [headerForm, setHeaderForm] = useState(emptyHeaderForm());
  const [headerError, setHeaderError] = useState('');
  const [profilesEnvironment, setProfilesEnvironment] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [editingProfileIsAnonymous, setEditingProfileIsAnonymous] =
    useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [profileError, setProfileError] = useState('');
  const input = { productId };

  const { data: product } = trpc.products.get.useQuery({ id: productId });
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
  const headersInput = { environmentId: headersEnvironment?.id ?? 0 };
  const { data: headers = [] } = trpc.environments.listHeaders.useQuery(
    headersInput,
    { enabled: Boolean(headersEnvironment) },
  );
  const profileEnvironmentId = profilesEnvironment?.id ?? 0;
  const profileInput = { environmentId: profileEnvironmentId };
  const { data: profiles = [] } = trpc.environments.listProfiles.useQuery(
    profileInput,
    { enabled: Boolean(profilesEnvironment) },
  );
  const { data: profileVariables = [] } =
    trpc.environments.listVariables.useQuery(profileInput, {
      enabled: Boolean(profilesEnvironment),
    });
  const { data: profileCookies = [] } = trpc.environments.listCookies.useQuery(
    profileInput,
    { enabled: Boolean(profilesEnvironment) },
  );
  const { data: profileHeaders = [] } = trpc.environments.listHeaders.useQuery(
    profileInput,
    { enabled: Boolean(profilesEnvironment) },
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
  const refreshHeaders = () =>
    utils.environments.listHeaders.invalidate(headersInput);
  const resetHeaderEditor = () => {
    setEditingHeaderId(null);
    setHeaderForm(emptyHeaderForm(headersEnvironment?.baseOrigin));
    setHeaderError('');
  };
  const createHeader = trpc.environments.createHeader.useMutation({
    onSuccess: () => {
      refreshHeaders();
      resetHeaderEditor();
    },
    onError: (error) => setHeaderError(error.message),
  });
  const updateHeader = trpc.environments.updateHeader.useMutation({
    onSuccess: () => {
      refreshHeaders();
      resetHeaderEditor();
    },
    onError: (error) => setHeaderError(error.message),
  });
  const deleteHeader = trpc.environments.deleteHeader.useMutation({
    onSuccess: refreshHeaders,
    onError: (error) => setHeaderError(error.message),
  });
  const refreshProfiles = () =>
    utils.environments.listProfiles.invalidate(profileInput);
  const resetProfileEditor = () => {
    setEditingProfileId(null);
    setEditingProfileIsAnonymous(false);
    setProfileForm(emptyProfileForm);
    setProfileError('');
  };
  const createProfile = trpc.environments.createProfile.useMutation({
    onSuccess: () => {
      refreshProfiles();
      resetProfileEditor();
    },
    onError: (error) => setProfileError(error.message),
  });
  const updateProfile = trpc.environments.updateProfile.useMutation({
    onSuccess: () => {
      refreshProfiles();
      resetProfileEditor();
    },
    onError: (error) => setProfileError(error.message),
  });
  const deleteProfile = trpc.environments.deleteProfile.useMutation({
    onSuccess: refreshProfiles,
    onError: (error) => setProfileError(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId) {
      updateEnvironment.mutate({ id: editingId, ...form });
    } else {
      createEnvironment.mutate({
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

  const submitHeader = (event: React.FormEvent) => {
    event.preventDefault();
    if (!headersEnvironment) return;
    let canonicalOrigin: string;
    try {
      const origin = new URL(headerForm.origin);
      if (
        !['http:', 'https:'].includes(origin.protocol) ||
        origin.username ||
        origin.password
      ) {
        throw new Error('invalid origin');
      }
      canonicalOrigin = origin.origin;
    } catch {
      setHeaderError('Header origin must be a valid HTTP(S) origin');
      return;
    }
    if (headerForm.origin.trim() !== canonicalOrigin) {
      setHeaderError(
        `Header origin must be canonical and contain no path, query, or fragment. Use ${canonicalOrigin}`,
      );
      return;
    }
    if (editingHeaderId) {
      updateHeader.mutate({
        id: editingHeaderId,
        name: headerForm.name,
        origin: canonicalOrigin,
        enabled: headerForm.enabled,
        ...(headerForm.valueTemplate
          ? { valueTemplate: headerForm.valueTemplate }
          : {}),
      });
    } else {
      createHeader.mutate({
        environmentId: headersEnvironment.id,
        ...headerForm,
        origin: canonicalOrigin,
      });
    }
  };

  const submitProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!profilesEnvironment) return;
    if (editingProfileId) {
      updateProfile.mutate(
        editingProfileIsAnonymous
          ? {
              id: editingProfileId,
              enabled: profileForm.enabled,
              variableIds: profileForm.variableIds,
            }
          : { id: editingProfileId, ...profileForm },
      );
    } else {
      createProfile.mutate({
        environmentId: profilesEnvironment.id,
        ...profileForm,
      });
    }
  };

  const toggleProfileBinding = (
    field: 'variableIds' | 'cookieIds' | 'headerIds',
    bindingId: number,
    selected: boolean,
  ) => {
    const values = new Set(profileForm[field]);
    if (selected) values.add(bindingId);
    else values.delete(bindingId);
    setProfileForm({
      ...profileForm,
      [field]: [...values].sort((left, right) => left - right),
    });
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
      <div className="grid gap-2">
        <Label htmlFor="environment-test-id">Test-ID attribute</Label>
        <Input
          id="environment-test-id"
          value={form.testIdAttribute}
          onChange={(event) =>
            setForm({ ...form, testIdAttribute: event.target.value })
          }
          placeholder="data-testid"
          required
        />
        <p className="text-xs text-muted-foreground">
          Browser-assisted generation uses this attribute for observed
          getByTestId locators.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="environment-default"
          checked={form.isDefault}
          onCheckedChange={(checked) =>
            setForm({ ...form, isDefault: checked === true })
          }
        />
        <Label htmlFor="environment-default">Default for this product</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Link to={`/projects/${projectId}`}>Project</Link>
            <span>/</span>
            <Link to={`/projects/${projectId}/products/${productId}`}>
              {product?.name || 'Product'}
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
            <Link to={`/projects/${projectId}/products/${productId}`}>
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
                    This environment will belong to{' '}
                    {product?.name || 'this product'}.
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
                      testIdAttribute: environment.testIdAttribute,
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
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProfilesEnvironment({
                        id: environment.id,
                        name: environment.name,
                      });
                      resetProfileEditor();
                    }}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Test profiles
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
        open={profilesEnvironment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProfilesEnvironment(null);
            resetProfileEditor();
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{profilesEnvironment?.name} test profiles</DialogTitle>
            <DialogDescription>
              Test profiles describe a browser role and starting authentication
              state. Guest is always unauthenticated. Advanced keeps the legacy
              variable, cookie, and exact-origin header bindings available while
              sessions are migrated to direct encrypted state.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitProfile}>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-2">
                <Label htmlFor="profile-name">Profile name</Label>
                <Input
                  id="profile-name"
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, name: event.target.value })
                  }
                  placeholder="Authenticated User"
                  disabled={editingProfileIsAnonymous}
                  required
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Checkbox
                  id="profile-enabled"
                  checked={profileForm.enabled}
                  onCheckedChange={(checked) =>
                    setProfileForm({
                      ...profileForm,
                      enabled: checked === true,
                    })
                  }
                />
                <Label htmlFor="profile-enabled">Enabled</Label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="profile-description">
                  Role and intended use
                </Label>
                <Input
                  id="profile-description"
                  value={profileForm.description}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="Administrators with access to user management"
                  disabled={editingProfileIsAnonymous}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-mode">Mode</Label>
                <select
                  id="profile-mode"
                  className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={profileForm.mode}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      mode: event.target.value as 'basic' | 'advanced',
                    })
                  }
                  disabled={editingProfileIsAnonymous}
                >
                  <option value="basic">Basic — captured session</option>
                  <option value="advanced">
                    Advanced — cookies and headers
                  </option>
                </select>
              </div>
            </div>

            {profileForm.mode === 'advanced' && (
              <div className="grid gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p>
                  Cookie expiration only controls browser storage. It cannot
                  extend the server session or token lifetime. Legacy bindings
                  remain available here only for migration compatibility.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!profilesEnvironment) return;
                      setVariablesEnvironment(profilesEnvironment);
                      setProfilesEnvironment(null);
                      setEditingVariableId(null);
                      setVariableForm(emptyVariableForm);
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Legacy variables
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!profilesEnvironment) return;
                      setCookiesEnvironment(profilesEnvironment);
                      setProfilesEnvironment(null);
                      resetCookieEditor();
                    }}
                  >
                    <Cookie className="mr-2 h-4 w-4" />
                    Legacy cookies
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!profilesEnvironment) return;
                      const environment = (environments ?? []).find(
                        ({ id }) => id === profilesEnvironment.id,
                      );
                      if (!environment) return;
                      const baseOrigin = new URL(environment.baseUrl).origin;
                      setHeadersEnvironment({
                        ...profilesEnvironment,
                        baseOrigin,
                      });
                      setProfilesEnvironment(null);
                      setEditingHeaderId(null);
                      setHeaderForm(emptyHeaderForm(baseOrigin));
                    }}
                  >
                    <Braces className="mr-2 h-4 w-4" />
                    Legacy headers
                  </Button>
                </div>
              </div>
            )}

            {profileForm.mode === 'advanced' &&
              (
                [
                  [
                    'Variables',
                    'variableIds',
                    profileVariables,
                    (item: (typeof profileVariables)[number]) => item.key,
                  ],
                  [
                    'Cookies',
                    'cookieIds',
                    profileCookies,
                    (item: (typeof profileCookies)[number]) => item.name,
                  ],
                  [
                    'Headers',
                    'headerIds',
                    profileHeaders,
                    (item: (typeof profileHeaders)[number]) =>
                      `${item.name} · ${item.origin}`,
                  ],
                ] as const
              ).map(([title, field, items, labelFor]) => (
                <div key={field} className="grid gap-2 rounded-md border p-3">
                  <div className="text-sm font-medium">{title}</div>
                  {items.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={profileForm[field].includes(item.id)}
                            disabled={
                              field !== 'variableIds' &&
                              editingProfileIsAnonymous
                            }
                            onCheckedChange={(checked) =>
                              toggleProfileBinding(
                                field,
                                item.id,
                                checked === true,
                              )
                            }
                          />
                          <span className="truncate">
                            {labelFor(item as never)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No {title.toLowerCase()} configured.
                    </p>
                  )}
                </div>
              ))}

            <div className="flex justify-end gap-2">
              {editingProfileId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetProfileEditor}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={createProfile.isPending || updateProfile.isPending}
              >
                {editingProfileId ? 'Save profile' : 'Add profile'}
              </Button>
            </div>
          </form>

          {profileError && (
            <p className="text-sm text-destructive">{profileError}</p>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{profile.name}</span>
                    {profile.isAnonymous && <Badge>Guest</Badge>}
                    <Badge variant="outline">{profile.mode}</Badge>
                    <Badge
                      variant={
                        profile.authenticationStatus === 'ready'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {profile.authenticationStatus.replace(/_/g, ' ')}
                    </Badge>
                    {!profile.enabled && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                    <Badge variant="outline">revision {profile.revision}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {profile.description || 'No role description'} · revision{' '}
                    {profile.revision}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Captured{' '}
                    {profile.capturedAt
                      ? new Date(profile.capturedAt).toLocaleString()
                      : 'never'}{' '}
                    · Verified{' '}
                    {profile.verifiedAt
                      ? new Date(profile.verifiedAt).toLocaleString()
                      : 'never'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingProfileId(profile.id);
                      setEditingProfileIsAnonymous(profile.isAnonymous);
                      setProfileForm({
                        name: profile.name,
                        description: profile.description ?? '',
                        mode: profile.mode,
                        enabled: profile.enabled,
                        variableIds: profile.variableIds,
                        cookieIds: profile.cookieIds,
                        headerIds: profile.headerIds,
                      });
                      setProfileError('');
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!profile.isAnonymous && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteProfile.mutate({ id: profile.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
                          ? formatDateTimeLocal(cookie.expiresAt)
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

      <Dialog
        open={headersEnvironment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHeadersEnvironment(null);
            setEditingHeaderId(null);
            setHeaderForm(emptyHeaderForm());
            setHeaderError('');
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{headersEnvironment?.name} headers</DialogTitle>
            <DialogDescription>
              Values must use environment templates such as{' '}
              <code>{'Bearer {{access_token}}'}</code>. Resolved values are
              injected only for the exact configured origin and are never stored
              or returned by the API.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitHeader}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="header-name">Name</Label>
                <Input
                  id="header-name"
                  value={headerForm.name}
                  onChange={(event) =>
                    setHeaderForm({ ...headerForm, name: event.target.value })
                  }
                  placeholder="Authorization"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="header-value">Value template</Label>
                <Input
                  id="header-value"
                  type="password"
                  value={headerForm.valueTemplate}
                  onChange={(event) =>
                    setHeaderForm({
                      ...headerForm,
                      valueTemplate: event.target.value,
                    })
                  }
                  placeholder={
                    editingHeaderId
                      ? 'Leave blank to keep the existing template'
                      : 'Bearer {{access_token}}'
                  }
                  required={!editingHeaderId}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="header-origin">Exact request origin</Label>
              <Input
                id="header-origin"
                type="url"
                value={headerForm.origin}
                onChange={(event) =>
                  setHeaderForm({ ...headerForm, origin: event.target.value })
                }
                placeholder={headersEnvironment?.baseOrigin}
                required
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="header-enabled"
                  checked={headerForm.enabled}
                  onCheckedChange={(checked) =>
                    setHeaderForm({
                      ...headerForm,
                      enabled: checked === true,
                    })
                  }
                />
                <Label htmlFor="header-enabled">Enabled</Label>
              </div>
              <div className="flex gap-2">
                {editingHeaderId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetHeaderEditor}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createHeader.isPending || updateHeader.isPending}
                >
                  {editingHeaderId ? 'Save header' : 'Add header'}
                </Button>
              </div>
            </div>
          </form>

          {headerError && (
            <p className="text-sm text-destructive">{headerError}</p>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {headers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No custom headers configured yet.
              </p>
            )}
            {headers.map((header) => (
              <div
                key={header.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="font-medium">{header.name}</code>
                    {!header.enabled && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    •••••••• · {header.origin}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingHeaderId(header.id);
                      setHeaderForm({
                        name: header.name,
                        valueTemplate: '',
                        origin: header.origin,
                        enabled: header.enabled,
                      });
                      setHeaderError('');
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteHeader.mutate({ id: header.id })}
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
