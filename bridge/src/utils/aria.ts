// Roles worth surfacing as locator suggestions
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "combobox",
  "checkbox",
  "radio",
  "menuitem",
  "tab",
  "switch",
  "searchbox",
  "spinbutton",
  "listbox",
  "option",
  "menuitemcheckbox",
  "menuitemradio",
]);

export interface LocatorSuggestion {
  element: string;
  locator: string;
  priority: 1 | 2;
}

// ---------------------------------------------------------------------------
// Parse the YAML-like ariaSnapshot string and emit getByRole() suggestions.
// Each line looks like:  - role "name" or  - role "name" [level=2] etc.
// ---------------------------------------------------------------------------
export function extractLocatorsFromSnapshot(snapshot: string): LocatorSuggestion[] {
  const results: LocatorSuggestion[] = [];
  const lineRe = /^[\s-]*(\w[\w-]*)\s+"([^"]+)"/;

  for (const raw of snapshot.split("\n")) {
    const m = raw.match(lineRe);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const name = m[2];
    if (!INTERACTIVE_ROLES.has(role)) continue;
    results.push(buildSuggestion(role, name));
  }

  return results;
}

function buildSuggestion(role: string, name: string): LocatorSuggestion {
  // Use regex when name has leading/trailing whitespace or mixed-case risk
  const trimmed = name.trim();
  const needsRegex = name !== trimmed || /[A-Z]/.test(name);
  const nameArg = needsRegex
    ? `/${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/i`
    : `'${trimmed}'`;

  const locator = `page.getByRole('${role}', { name: ${nameArg} })`;
  const priority: 1 | 2 = ["button", "textbox", "link", "combobox"].includes(role)
    ? 1
    : 2;

  return {
    element: `${capitalize(role)} "${trimmed}"`,
    locator,
    priority,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
