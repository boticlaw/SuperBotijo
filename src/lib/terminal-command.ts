interface CommandPolicy {
  allowBundledShortFlags?: boolean;
  allowedFlags?: readonly string[];
  allowedSubcommands?: readonly string[];
  valueFlags?: readonly string[];
}

interface ParsedCommand {
  args: string[];
  executable: string;
}

export interface TerminalCommandValidationError {
  error: string;
  hint?: string;
  ok: false;
  status: number;
}

export interface TerminalCommandValidationSuccess {
  args: string[];
  command: string;
  executable: string;
  ok: true;
}

export type TerminalCommandValidationResult =
  | TerminalCommandValidationError
  | TerminalCommandValidationSuccess;

const FORBIDDEN_SHELL_PATTERN = /[\n\r;&|`]/;
const FORBIDDEN_SUBSHELL_PATTERN = /\$\(|\$\{/;
const FORBIDDEN_REDIRECTION_PATTERN = /(^|\s)(?:>|>>|<|<<)(?=\s|$)/;

const COMMAND_POLICIES: Record<string, CommandPolicy> = {
  awk: {
    allowedFlags: ["-F", "-f", "-v"],
    valueFlags: ["-F", "-f", "-v"],
  },
  cat: {
    allowedFlags: ["-n", "-b", "-s", "-E", "-T", "-v", "--number", "--number-nonblank", "--squeeze-blank"],
  },
  cut: {
    allowedFlags: ["-b", "-c", "-d", "-f", "-s", "--delimiter", "--fields"],
    valueFlags: ["-b", "-c", "-d", "-f", "--delimiter", "--fields"],
  },
  date: {
    allowedFlags: ["-u", "--utc", "-I", "--iso-8601", "-R", "--rfc-email"],
  },
  df: {
    allowBundledShortFlags: true,
    allowedFlags: ["-a", "-B", "-h", "-H", "-i", "-k", "-l", "-m", "-P", "-T", "--all", "--block-size", "--human-readable", "--inodes", "--local", "--portability", "--si", "--type"],
    valueFlags: ["-B", "--block-size", "--type"],
  },
  dig: {
    allowedFlags: ["+short", "+stats", "+noall", "+answer"],
  },
  docker: {
    allowedFlags: ["-a", "--all", "--format", "--no-trunc", "--quiet", "-q", "--size"],
    allowedSubcommands: ["images", "info", "inspect", "logs", "ps", "stats", "version"],
    valueFlags: ["--format"],
  },
  du: {
    allowBundledShortFlags: true,
    allowedFlags: ["-a", "-b", "-c", "-d", "-h", "-k", "-m", "-s", "-x", "--all", "--bytes", "--human-readable", "--max-depth", "--one-file-system", "--summarize", "--total"],
    valueFlags: ["-d", "--max-depth"],
  },
  echo: {
    allowedFlags: ["-n", "-e", "-E"],
  },
  file: {
    allowedFlags: ["-b", "-i", "--brief", "--mime"],
  },
  find: {
    allowedFlags: ["-name", "-iname", "-type", "-maxdepth", "-mindepth", "-mtime", "-size", "-empty", "-print", "-L", "-H", "-P"],
    valueFlags: ["-name", "-iname", "-type", "-maxdepth", "-mindepth", "-mtime", "-size"],
  },
  free: {
    allowedFlags: ["-b", "-k", "-m", "-g", "-h", "--bytes", "--kilo", "--mega", "--giga", "--human"],
  },
  git: {
    allowedFlags: ["--oneline", "--decorate", "--graph", "--short", "--stat", "--name-only", "--cached", "--staged", "--all", "-n", "-p"],
    allowedSubcommands: ["branch", "diff", "log", "remote", "rev-parse", "show", "status"],
    valueFlags: ["-n"],
  },
  grep: {
    allowBundledShortFlags: true,
    allowedFlags: ["-E", "-F", "-R", "-c", "-i", "-l", "-n", "-r", "-v", "-w", "-x", "--count", "--fixed-strings", "--ignore-case", "--line-number", "--recursive", "--word-regexp"],
  },
  head: {
    allowedFlags: ["-n", "-c", "-q", "-v", "--lines", "--bytes", "--quiet", "--verbose"],
    valueFlags: ["-n", "-c", "--lines", "--bytes"],
  },
  host: {
    allowedFlags: ["-a", "-t", "-v"],
    valueFlags: ["-t"],
  },
  hostname: {
    allowedFlags: ["-f", "-i", "--fqdn", "--ip-address"],
  },
  htop: {
    allowedFlags: ["-d", "-s", "-u", "--delay", "--sort-key", "--user"],
    valueFlags: ["-d", "-s", "-u", "--delay", "--sort-key", "--user"],
  },
  id: {
    allowedFlags: ["-u", "-g", "-G", "-n"],
  },
  ifconfig: {
    allowedFlags: ["-a"],
  },
  ip: {
    allowedSubcommands: ["addr", "address", "link", "route", "neigh"],
  },
  journalctl: {
    allowedFlags: ["-n", "-u", "--since", "--until", "--no-pager", "--output"],
    valueFlags: ["-n", "-u", "--since", "--until", "--output"],
  },
  locate: {
    allowedFlags: ["-b", "-c", "-i", "-l", "--basename", "--count", "--ignore-case", "--limit"],
    valueFlags: ["-l", "--limit"],
  },
  ls: {
    allowBundledShortFlags: true,
    allowedFlags: ["-1", "-A", "-R", "-S", "-a", "-d", "-h", "-l", "-r", "-t", "--all", "--almost-all", "--classify", "--human-readable", "--reverse", "--sort"],
    valueFlags: ["--sort"],
  },
  lsof: {
    allowedFlags: ["-i", "-p", "-u", "-n", "-P"],
    valueFlags: ["-i", "-p", "-u"],
  },
  netstat: {
    allowBundledShortFlags: true,
    allowedFlags: ["-a", "-l", "-n", "-p", "-r", "-t", "-u", "-w", "--all", "--numeric", "--program", "--route"],
  },
  nslookup: {
    allowedFlags: ["-type"],
    valueFlags: ["-type"],
  },
  pgrep: {
    allowedFlags: ["-a", "-f", "-l", "-n", "-o", "-u"],
    valueFlags: ["-u"],
  },
  pidof: {
    allowedFlags: ["-s", "-x"],
  },
  ping: {
    allowedFlags: ["-c", "-i", "-s", "-W", "-w"],
    valueFlags: ["-c", "-i", "-s", "-W", "-w"],
  },
  pm2: {
    allowedSubcommands: ["describe", "env", "jlist", "list", "logs", "monit", "show", "status"],
  },
  printf: {},
  ps: {
    allowBundledShortFlags: true,
    allowedFlags: ["-A", "-a", "-e", "-f", "-o", "-p", "-u", "-x", "--format", "--pid", "--user"],
    valueFlags: ["-o", "-p", "-u", "--format", "--pid", "--user"],
  },
  sed: {
    allowedFlags: ["-n", "-E", "-e"],
    valueFlags: ["-e"],
  },
  sort: {
    allowBundledShortFlags: true,
    allowedFlags: ["-n", "-r", "-u", "-k", "-t", "--numeric-sort", "--reverse", "--unique"],
    valueFlags: ["-k", "-t"],
  },
  ss: {
    allowBundledShortFlags: true,
    allowedFlags: ["-a", "-l", "-n", "-p", "-t", "-u", "-x", "--all", "--listening", "--numeric", "--processes", "--tcp", "--udp", "--unix"],
  },
  stat: {
    allowedFlags: ["-c", "--format", "-L"],
    valueFlags: ["-c", "--format"],
  },
  systemctl: {
    allowedFlags: ["--no-pager", "--type", "--state"],
    allowedSubcommands: ["is-active", "is-enabled", "list-units", "show", "status"],
    valueFlags: ["--type", "--state"],
  },
  tail: {
    allowedFlags: ["-n", "-c", "-q", "-v", "--lines", "--bytes", "--quiet", "--verbose"],
    valueFlags: ["-n", "-c", "--lines", "--bytes"],
  },
  top: {
    allowedFlags: ["-b", "-n", "-u"],
    valueFlags: ["-n", "-u"],
  },
  tr: {
    allowedFlags: ["-d", "-s"],
  },
  uname: {
    allowBundledShortFlags: true,
    allowedFlags: ["-a", "-m", "-n", "-r", "-s", "-v", "--all", "--kernel-name", "--kernel-release", "--machine", "--nodename"],
  },
  uniq: {
    allowedFlags: ["-c", "-d", "-u", "-i", "--count", "--repeated", "--unique", "--ignore-case"],
  },
  uptime: {
    allowedFlags: ["-p", "-s", "--pretty", "--since"],
  },
  wc: {
    allowBundledShortFlags: true,
    allowedFlags: ["-c", "-l", "-m", "-w", "--bytes", "--chars", "--lines", "--words"],
  },
  which: {
    allowedFlags: ["-a", "--all"],
  },
  whoami: {},
  type: {},
  xargs: {
    allowedFlags: ["-n", "-0", "-I", "--max-args", "--replace"],
    valueFlags: ["-n", "-I", "--max-args", "--replace"],
  },
};

function parseCommand(raw: string): ParsedCommand | null {
  const command = raw.trim();
  if (!command) {
    return null;
  }

  const tokens: string[] = [];
  let currentToken = "";
  let quoteChar: "'" | "\"" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];

    if (quoteChar !== null) {
      if (character === "\\") {
        const nextCharacter = command[index + 1];
        if (nextCharacter) {
          currentToken += nextCharacter;
          index += 1;
          continue;
        }
      }

      if (character === quoteChar) {
        quoteChar = null;
        continue;
      }

      currentToken += character;
      continue;
    }

    if (character === "\"" || character === "'") {
      quoteChar = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }

    if (character === "\\") {
      const nextCharacter = command[index + 1];
      if (nextCharacter) {
        currentToken += nextCharacter;
        index += 1;
      } else {
        currentToken += character;
      }
      continue;
    }

    currentToken += character;
  }

  if (quoteChar !== null) {
    return null;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  if (tokens.length === 0) {
    return null;
  }

  return {
    args: tokens.slice(1),
    executable: tokens[0],
  };
}

function validateSubcommand(
  command: string,
  args: string[],
  allowedSubcommands: readonly string[]
): TerminalCommandValidationError | null {
  const firstPositional = args.find((arg) => !arg.startsWith("-"));
  if (!firstPositional || !allowedSubcommands.includes(firstPositional)) {
    return {
      error: `Command \"${command}\" only allows read-only subcommands`,
      hint: `Allowed subcommands: ${allowedSubcommands.join(", ")}`,
      ok: false,
      status: 403,
    };
  }

  return null;
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

function validateArguments(
  command: string,
  args: string[],
  policy: CommandPolicy
): TerminalCommandValidationError | null {
  const allowedFlags = new Set(policy.allowedFlags ?? []);
  const valueFlags = new Set(policy.valueFlags ?? []);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-")) {
      continue;
    }

    if (arg.startsWith("--")) {
      const [flag, inlineValue] = arg.split("=", 2);
      if (!allowedFlags.has(flag)) {
        return {
          error: `Flag \"${flag}\" is not allowed for \"${command}\"`,
          hint: "Use only allowlisted flags for this command.",
          ok: false,
          status: 403,
        };
      }

      if (valueFlags.has(flag) && !inlineValue) {
        const nextArg = args[index + 1];
        if (!nextArg || nextArg.startsWith("-")) {
          return {
            error: `Flag \"${flag}\" requires a value`,
            ok: false,
            status: 400,
          };
        }
        index += 1;
      }
      continue;
    }

    if (!allowedFlags.has(arg)) {
      if (policy.allowBundledShortFlags && arg.length > 2) {
        const bundledFlags = arg.slice(1).split("").map((letter) => `-${letter}`);
        if (bundledFlags.every((flag) => allowedFlags.has(flag) && !valueFlags.has(flag))) {
          continue;
        }
      }

      if (arg.length > 2) {
        const maybeValueFlag = arg.slice(0, 2);
        const attachedValue = arg.slice(2);
        if (valueFlags.has(maybeValueFlag) && attachedValue.length > 0) {
          if (["-n", "-c", "-w", "-W", "-s", "-d", "-l", "-m"].includes(maybeValueFlag) && !isNumeric(attachedValue)) {
            return {
              error: `Flag \"${maybeValueFlag}\" requires a numeric value`,
              ok: false,
              status: 400,
            };
          }
          continue;
        }
      }

      return {
        error: `Flag \"${arg}\" is not allowed for \"${command}\"`,
        hint: "Use only allowlisted flags for this command.",
        ok: false,
        status: 403,
      };
    }

    if (valueFlags.has(arg)) {
      const nextArg = args[index + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        return {
          error: `Flag \"${arg}\" requires a value`,
          ok: false,
          status: 400,
        };
      }
      index += 1;
    }
  }

  return null;
}

export function validateTerminalCommand(raw: string): TerminalCommandValidationResult {
  const command = raw.trim();

  if (!command) {
    return {
      error: "No command provided",
      ok: false,
      status: 400,
    };
  }

  if (FORBIDDEN_SHELL_PATTERN.test(command) || FORBIDDEN_SUBSHELL_PATTERN.test(command) || FORBIDDEN_REDIRECTION_PATTERN.test(command)) {
    return {
      error: "Invalid command format",
      hint: "Pipes, chaining, subshells, backticks, redirects, and multiline input are blocked.",
      ok: false,
      status: 400,
    };
  }

  const parsed = parseCommand(command);
  if (!parsed) {
    return {
      error: "Invalid command format",
      hint: "Malformed quoting or escaping detected.",
      ok: false,
      status: 400,
    };
  }

  const policy = COMMAND_POLICIES[parsed.executable];
  if (!policy) {
    return {
      error: `Command not allowed: \"${parsed.executable}\"`,
      hint: "Only read-only allowlisted commands are permitted.",
      ok: false,
      status: 403,
    };
  }

  if (policy.allowedSubcommands) {
    const subcommandError = validateSubcommand(parsed.executable, parsed.args, policy.allowedSubcommands);
    if (subcommandError) {
      return subcommandError;
    }
  }

  const argumentError = validateArguments(parsed.executable, parsed.args, policy);
  if (argumentError) {
    return argumentError;
  }

  return {
    args: parsed.args,
    command,
    executable: parsed.executable,
    ok: true,
  };
}
