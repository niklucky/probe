import {
  productTypes,
  resultStatuses,
  testPriorities,
  testStatuses,
  userRoles,
} from './enums';

export type UserRole = (typeof userRoles)[number];

export type ProductType = (typeof productTypes)[number];

export type TestPriority = (typeof testPriorities)[number];

export type TestStatus = (typeof testStatuses)[number];

export type ResultStatus = (typeof resultStatuses)[number];

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  avatarType: 'predefined' | 'custom' | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  projectId: number;
  name: string;
  type: ProductType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: number;
  projectId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  user?: User;
  role: UserRole;
  invitedAt: string;
  joinedAt: string | null;
}

export interface TestSuite {
  id: number;
  productId: number;
  name: string;
  description: string | null;
  currentVersionId: number | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestSuiteVersion {
  id: number;
  suiteId: number;
  versionNumber: number;
  name: string;
  description: string | null;
  createdById: number;
  createdAt: string;
}

export interface TestCase {
  id: number;
  suiteId: number;
  currentVersionId: number | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseVersion {
  id: number;
  testCaseId: number;
  suiteVersionId: number;
  versionNumber: number;
  title: string;
  description: string | null;
  steps: string[];
  expectedResult: string | null;
  priority: TestPriority;
  status: TestStatus;
  tags: string[];
  createdById: number;
  createdAt: string;
}

export interface TestRun {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  executedById: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface TestRunItem {
  id: number;
  runId: number;
  testCaseVersionId: number;
  testCaseVersion?: TestCaseVersion;
  orderIndex: number;
}

export interface TestResult {
  id: number;
  runId: number;
  testCaseVersionId: number;
  testCaseVersion?: TestCaseVersion;
  status: ResultStatus;
  notes: string | null;
  executedById: number | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
