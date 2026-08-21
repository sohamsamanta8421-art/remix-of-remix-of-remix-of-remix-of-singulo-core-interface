/**
 * Small, dependency-free expression evaluator (shunting-yard).
 * No eval / Function constructor: untrusted model output must never be executed.
 */
const FUNCS: Record<string, (n: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

type Token = string;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const src = input.replace(/\s+/g, "").toLowerCase();
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < src.length && /[0-9.]/.test(src[i] as string)) num += src[i++];
      tokens.push(num);
      continue;
    }
    if (/[a-z]/.test(ch)) {
      let name = "";
      while (i < src.length && /[a-z]/.test(src[i] as string)) name += src[i++];
      if (name === "pi") tokens.push(String(Math.PI));
      else if (name === "e") tokens.push(String(Math.E));
      else if (FUNCS[name]) tokens.push(name);
      else throw new Error(`Unknown symbol "${name}"`);
      continue;
    }
    if ("+-*/%^()".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    throw new Error(`Unsupported character "${ch}"`);
  }
  return tokens;
}

export function calculate(expression: string): number {
  if (expression.length > 200) throw new Error("Expression too long");
  const tokens = tokenize(expression);
  const output: Token[] = [];
  const ops: Token[] = [];
  let prev: Token | undefined;

  for (const token of tokens) {
    if (/^[0-9.]+$/.test(token)) {
      output.push(token);
    } else if (FUNCS[token]) {
      ops.push(token);
    } else if (token === "(") {
      ops.push(token);
    } else if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      if (!ops.length) throw new Error("Unbalanced parentheses");
      ops.pop();
      if (ops.length && FUNCS[ops[ops.length - 1] as string]) output.push(ops.pop()!);
    } else {
      // unary minus
      const unary =
        token === "-" && (prev === undefined || prev === "(" || PREC[prev] !== undefined);
      const topPrec = () => PREC[ops[ops.length - 1] as string];
      if (unary) {
        output.push("0");
      }
      while (
        ops.length &&
        topPrec() !== undefined &&
        (topPrec() as number) >= (PREC[token] as number) &&
        token !== "^"
      ) {
        output.push(ops.pop()!);
      }
      ops.push(token);
    }
    prev = token;
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(") throw new Error("Unbalanced parentheses");
    output.push(op);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (/^[0-9.]+$/.test(token)) {
      stack.push(Number(token));
    } else if (FUNCS[token]) {
      const a = stack.pop();
      if (a === undefined) throw new Error("Malformed expression");
      stack.push((FUNCS[token] as (n: number) => number)(a));
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Malformed expression");
      stack.push(
        token === "+"
          ? a + b
          : token === "-"
            ? a - b
            : token === "*"
              ? a * b
              : token === "/"
                ? a / b
                : token === "%"
                  ? a % b
                  : a ** b,
      );
    }
  }
  const result = stack.pop();
  if (result === undefined || stack.length || !Number.isFinite(result)) {
    throw new Error("Could not evaluate expression");
  }
  return result;
}