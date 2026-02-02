import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  Play,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  Check
} from 'lucide-react';

interface SelectedTestCase {
  suiteId: number;
  testCaseId: number;
  versionId: number;
  title: string;
}

export function TestRunCreatePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const id = Number(projectId);

  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { id },
    { enabled: !!id }
  );

  const { data: products, isLoading: isLoadingProducts } = trpc.products.list.useQuery(
    { projectId: id },
    { enabled: !!id }
  );

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  
  const { data: testSuites, isLoading: isLoadingSuites } = trpc.testSuites.list.useQuery(
    { productId: selectedProductId || 0 },
    { enabled: !!selectedProductId }
  );

  const [runName, setRunName] = useState('');
  const [runDescription, setRunDescription] = useState('');
  const [expandedSuites, setExpandedSuites] = useState<Set<number>>(new Set());
  const [selectedTestCases, setSelectedTestCases] = useState<SelectedTestCase[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<number | null>(null);

  const { data: testCases, isLoading: isLoadingTestCases } = trpc.testCases.list.useQuery(
    { suiteId: selectedSuiteId || 0 },
    { enabled: !!selectedSuiteId }
  );

  const createRun = trpc.testRuns.create.useMutation({
    onSuccess: (data) => {
      navigate(`/projects/${projectId}/runs/${data.id}/execute`);
    },
  });

  const toggleSuite = (suiteId: number) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suiteId)) {
        newSet.delete(suiteId);
        if (selectedSuiteId === suiteId) {
          setSelectedSuiteId(null);
        }
      } else {
        newSet.add(suiteId);
        setSelectedSuiteId(suiteId);
      }
      return newSet;
    });
  };

  const toggleTestCase = (suiteId: number, testCase: any) => {
    const version = testCase.currentVersion || testCase.versions?.[0];
    if (!version) return;

    setSelectedTestCases(prev => {
      const exists = prev.find(tc => tc.testCaseId === testCase.id);
      if (exists) {
        return prev.filter(tc => tc.testCaseId !== testCase.id);
      } else {
        return [...prev, {
          suiteId,
          testCaseId: testCase.id,
          versionId: version.id,
          title: version.title,
        }];
      }
    });
  };

  const isTestCaseSelected = (testCaseId: number) => {
    return selectedTestCases.some(tc => tc.testCaseId === testCaseId);
  };

  // Check if all test cases in current suite are selected
  const areAllSuiteTestsSelected = () => {
    if (!testCases || testCases.length === 0) return false;
    return testCases.every((tc: any) => isTestCaseSelected(tc.id));
  };

  // Check if some (but not all) test cases in current suite are selected
  const areSomeSuiteTestsSelected = () => {
    if (!testCases || testCases.length === 0) return false;
    const selectedCount = testCases.filter((tc: any) => isTestCaseSelected(tc.id)).length;
    return selectedCount > 0 && selectedCount < testCases.length;
  };

  // Toggle all test cases in current suite
  const toggleAllSuiteTests = () => {
    if (!testCases) return;
    
    const allSelected = areAllSuiteTestsSelected();
    
    if (allSelected) {
      // Deselect all in this suite
      setSelectedTestCases(prev => prev.filter(tc => !testCases.some((t: any) => t.id === tc.testCaseId)));
    } else {
      // Select all in this suite
      const newSelections: SelectedTestCase[] = testCases
        .map((tc: any) => {
          const version = tc.currentVersion || tc.versions?.[0];
          if (!version) return null;
          return {
            suiteId: selectedSuiteId!,
            testCaseId: tc.id,
            versionId: version.id,
            title: version.title,
          };
        })
        .filter((tc): tc is SelectedTestCase => tc !== null);
      
      setSelectedTestCases(prev => {
        // Remove existing selections from this suite
        const filtered = prev.filter(tc => !testCases.some((t: any) => t.id === tc.testCaseId));
        // Add new selections
        return [...filtered, ...newSelections];
      });
    }
  };

  // Fetch all test cases for selected product
  const [shouldFetchAll, setShouldFetchAll] = useState(false);
  
  const { data: allProductTestCases, isLoading: isLoadingAllTestCases } = trpc.testCases.listByProduct.useQuery(
    { productId: selectedProductId || 0 },
    { 
      enabled: shouldFetchAll && !!selectedProductId,
    }
  );

  // When data is loaded, select all test cases
  useEffect(() => {
    if (allProductTestCases && shouldFetchAll) {
      const allTestCases: SelectedTestCase[] = [];
      
      allProductTestCases.forEach(suite => {
        suite.testCases.forEach((tc: any) => {
          const version = tc.currentVersion || tc.versions?.[0];
          if (version) {
            allTestCases.push({
              suiteId: suite.suiteId,
              testCaseId: tc.id,
              versionId: version.id,
              title: version.title,
            });
          }
        });
      });
      
      setSelectedTestCases(allTestCases);
      setShouldFetchAll(false);
    }
  }, [allProductTestCases, shouldFetchAll]);

  // Select all test cases in the selected product
  const selectAllProductTests = () => {
    if (!selectedProductId) return;
    setShouldFetchAll(true);
  };

  // Count selected tests in current product
  const getSelectedCountInProduct = () => {
    if (!testSuites) return 0;
    const suiteIds = testSuites.map(s => s.id);
    return selectedTestCases.filter(tc => suiteIds.includes(tc.suiteId)).length;
  };

  // Check if all tests in product are selected
  const areAllProductTestsSelected = () => {
    // This would require knowing the total count, which we don't have without fetching all
    // For now, just show indeterminate state if some are selected
    const count = getSelectedCountInProduct();
    return count > 0 && count === selectedTestCases.length;
  };

  const handleCreateRun = () => {
    if (selectedTestCases.length === 0) return;

    createRun.mutate({
      projectId: id,
      name: runName || undefined,
      description: runDescription || undefined,
      testCaseVersionIds: selectedTestCases.map(tc => tc.versionId),
    });
  };

  if (isLoadingProject) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
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
            <Link to={`/projects/${projectId}/runs`} className="hover:text-foreground">Test Runs</Link>
            <span>/</span>
            <span>New Run</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create Test Run</h1>
          <p className="text-muted-foreground">
            Select test suites and test cases to include in this run
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/projects/${projectId}/runs`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Run Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Run Details</CardTitle>
              <CardDescription>Basic information about this test run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="run-name">
                  Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="run-name"
                  placeholder={`e.g., ${new Date().toLocaleDateString()}`}
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to current date if left empty
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-description">Description</Label>
                <Textarea
                  id="run-description"
                  placeholder="What are you testing?"
                  value={runDescription}
                  onChange={(e) => setRunDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selection Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Selected Tests:</span>
                  <span className="font-medium">{selectedTestCases.length}</span>
                </div>
                {selectedTestCases.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Selected:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedTestCases.map(tc => (
                        <div key={tc.testCaseId} className="text-sm truncate">
                          • {tc.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full" 
            size="lg"
            disabled={selectedTestCases.length === 0 || createRun.isPending}
            onClick={handleCreateRun}
          >
            <Play className="mr-2 h-4 w-4" />
            {createRun.isPending ? 'Creating...' : `Start Run (${selectedTestCases.length} tests)`}
          </Button>
        </div>

        {/* Right Panel - Test Selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Test Cases</CardTitle>
                  <CardDescription>
                    Choose a product and test suite to select test cases
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingProducts ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : !products || products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products found. Create products and test suites first.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Product Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Select Product</Label>
                      {selectedProductId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllProductTests}
                          disabled={isLoadingAllTestCases}
                        >
                          {isLoadingAllTestCases ? (
                            <>Loading...</>
                          ) : (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              Select All in Product
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {products.map(product => {
                        const isSelected = selectedProductId === product.id;
                        
                        return (
                          <button
                            key={product.id}
                            onClick={() => setSelectedProductId(product.id)}
                            className={`flex items-center gap-2 p-3 border rounded-lg text-left transition-colors ${
                              isSelected 
                                ? 'border-primary bg-primary/5' 
                                : 'hover:bg-accent/50'
                            }`}
                          >
                            <Folder className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{product.name}</div>
                              <Badge variant="secondary" className="text-xs">{product.type}</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Test Suites for Selected Product */}
                  {selectedProductId && (
                    <div>
                      <Label className="mb-2 block">Select Test Suite</Label>
                      {isLoadingSuites ? (
                        <Skeleton className="h-12" />
                      ) : !testSuites || testSuites.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          No test suites in this product
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {testSuites.map(suite => {
                            const isExpanded = expandedSuites.has(suite.id);
                            const isSelected = selectedSuiteId === suite.id;

                            return (
                              <div key={suite.id} className="border rounded-lg overflow-hidden">
                                <button
                                  onClick={() => toggleSuite(suite.id)}
                                  className={`w-full flex items-center gap-2 p-3 text-left transition-colors ${
                                    isSelected ? 'bg-primary/5' : 'hover:bg-accent/50'
                                  }`}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span className="font-medium">{suite.name}</span>
                                </button>
                                
                                {isExpanded && (
                                  <div className="border-t bg-muted/30 p-2">
                                    {isLoadingTestCases ? (
                                      <Skeleton className="h-20" />
                                    ) : !testCases || testCases.length === 0 ? (
                                      <p className="text-sm text-muted-foreground p-2">
                                        No test cases in this suite
                                      </p>
                                    ) : (
                                      <div className="space-y-1">
                                        {/* Select All checkbox for this suite */}
                                        <div className="flex items-center gap-2 p-2 border-b border-border/50">
                                          <Checkbox
                                            id={`select-all-${suite.id}`}
                                            checked={areAllSuiteTestsSelected()}
                                            data-state={areSomeSuiteTestsSelected() ? 'indeterminate' : areAllSuiteTestsSelected() ? 'checked' : 'unchecked'}
                                            onCheckedChange={toggleAllSuiteTests}
                                          />
                                          <Label 
                                            htmlFor={`select-all-${suite.id}`}
                                            className="text-sm font-medium cursor-pointer"
                                          >
                                            Select All ({testCases.length} tests)
                                          </Label>
                                        </div>
                                        
                                        {testCases.map((testCase: any) => {
                                          const version = testCase.currentVersion || testCase.versions?.[0];
                                          if (!version) return null;
                                          const isSelected = isTestCaseSelected(testCase.id);

                                          return (
                                            <button
                                              key={testCase.id}
                                              onClick={() => toggleTestCase(suite.id, testCase)}
                                              className="w-full flex items-start gap-2 p-2 hover:bg-accent/50 rounded text-left"
                                            >
                                              {isSelected ? (
                                                <CheckSquare className="h-4 w-4 mt-0.5 text-primary" />
                                              ) : (
                                                <Square className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                  <span className="font-medium truncate">{version.title}</span>
                                                </div>
                                                {version.description && (
                                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                                    {version.description}
                                                  </p>
                                                )}
                                              </div>
                                              <Badge className={
                                                version.priority === 'critical' ? 'bg-red-100 text-red-800 shrink-0' :
                                                version.priority === 'high' ? 'bg-orange-100 text-orange-800 shrink-0' :
                                                version.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 shrink-0' :
                                                'bg-green-100 text-green-800 shrink-0'
                                              }>
                                                {version.priority}
                                              </Badge>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
