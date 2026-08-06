import ts from 'typescript';

const CREDENTIAL_TEXT =
  /(?:password|passwd|secret|token|api[-_ ]?key|authorization|cookie|session|credential)/i;

export function sanitizeObservedText(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (CREDENTIAL_TEXT.test(normalized)) return '[REDACTED]';
  return normalized.slice(0, maxLength);
}

export interface LocatorPolicyResult {
  observedTestIds: string[];
  usedTestIds: string[];
  warnings: string[];
  inventedTestIds: string[];
}

export function inspectAutomationLocatorPolicy(
  source: string,
  observedTestIds: Iterable<string> = [],
): LocatorPolicyResult {
  const observed = new Set(observedTestIds);
  const sourceFile = ts.createSourceFile(
    'automation.spec.ts',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const used = new Set<string>();
  const warnings = new Set<string>();

  const literalArgument = (call: ts.CallExpression, index = 0) => {
    const argument = call.arguments[index];
    return argument && ts.isStringLiteralLike(argument)
      ? argument.text
      : undefined;
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const method = expression.name.text;
        if (method === 'getByTestId') {
          const value = literalArgument(node);
          if (value) used.add(value);
        }
        if (method === 'locator') {
          const value = literalArgument(node);
          if (value?.startsWith('//') || value?.startsWith('xpath=')) {
            warnings.add('Raw XPath locator used');
          } else {
            warnings.add('Raw CSS locator used');
          }
        }
        if (['nth', 'first', 'last'].includes(method)) {
          warnings.add('Fragile positional locator used');
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    observedTestIds: [...observed].sort(),
    usedTestIds: [...used].sort(),
    warnings: [...warnings],
    inventedTestIds: [...used].filter((value) => !observed.has(value)).sort(),
  };
}
