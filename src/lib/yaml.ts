import { theme } from "../theme";

export type Token = { text: string; color: string };

const scalarColor = (value: string): string => {
  const v = value.trim();
  if (/^(["']).*\1$/.test(v)) return theme.syntax.string;
  if (/^-?\d+(\.\d+)?([a-zA-Z]+)?$/.test(v)) return theme.syntax.number; // 8080, 250m, 128Mi
  if (/^(true|false|null|yes|no)$/i.test(v)) return theme.syntax.bool;
  return theme.syntax.plain;
};

/** A small line-based YAML highlighter. Good enough for Kubernetes manifests. */
export const highlightYamlLine = (line: string): Token[] => {
  const tokens: Token[] = [];
  let rest = line;

  const indent = rest.match(/^\s*/)?.[0] ?? "";
  if (indent) tokens.push({ text: indent, color: theme.syntax.plain });
  rest = rest.slice(indent.length);

  if (rest.startsWith("#")) return [...tokens, { text: rest, color: theme.syntax.comment }];
  if (rest === "---") return [...tokens, { text: rest, color: theme.syntax.punct }];

  while (rest.startsWith("- ")) {
    tokens.push({ text: "- ", color: theme.syntax.punct });
    rest = rest.slice(2);
  }

  let comment = "";
  const hash = rest.search(/\s#/);
  if (hash >= 0 && !/^(["']).*/.test(rest.slice(rest.indexOf(":") + 1).trim())) {
    comment = rest.slice(hash);
    rest = rest.slice(0, hash);
  }

  const key = rest.match(/^([^\s:'"][^:]*|"[^"]*"|'[^']*'):(\s|$)/);
  if (key) {
    tokens.push({ text: key[1], color: theme.syntax.key });
    tokens.push({ text: ":", color: theme.syntax.punct });
    rest = rest.slice(key[1].length + 1);
  }
  if (rest) tokens.push({ text: rest, color: key || rest.trim() ? scalarColor(rest) : theme.syntax.plain });
  if (comment) tokens.push({ text: comment, color: theme.syntax.comment });
  return tokens;
};
