import ts from 'typescript';

export interface AutomationEnvironmentReferences {
  references: string[];
  hasDynamicReference: boolean;
}

export function extractAutomationEnvironmentReferences(
  source: string,
): AutomationEnvironmentReferences {
  const sourceFile = ts.createSourceFile(
    'automation.spec.ts',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const references = new Set<string>();
  let hasDynamicReference = false;
  const isProcessEnv = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process' &&
    node.name.text === 'env';
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && isProcessEnv(node.expression)) {
      references.add(node.name.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      isProcessEnv(node.expression)
    ) {
      const argument = node.argumentExpression;
      if (argument && ts.isStringLiteralLike(argument)) {
        references.add(argument.text);
      } else {
        hasDynamicReference = true;
      }
    } else if (isProcessEnv(node)) {
      const parent = node.parent;
      if (!(
        (ts.isPropertyAccessExpression(parent) ||
          ts.isElementAccessExpression(parent)) &&
        parent.expression === node
      )) {
        hasDynamicReference = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { references: [...references], hasDynamicReference };
}
