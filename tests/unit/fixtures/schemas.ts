// Written with the help of Claude
import assert from 'node:assert/strict';

interface Issue {
  path: PropertyKey[];
  message: string;
}

type ParseResult = { success: true } | { success: false; error: { issues: Issue[] } };

/** The issues of a rejected parse; fails the test if the value was accepted. */
export function rejectedIssues(result: ParseResult): Issue[] {
  if (result.success) assert.fail('expected the value to be rejected');
  return result.error.issues;
}

/** The path of every issue of a rejected parse. */
export function rejectedPaths(result: ParseResult): PropertyKey[][] {
  return rejectedIssues(result).map((issue) => issue.path);
}
