/**
 * Git Dashboard API
 * GET /api/git - List all repos with status
 * POST /api/git - { repo, action } actions: status, pull, log, diff
 */
import { NextRequest, NextResponse } from 'next/server';
import { safeExecFile, validatePath, isValidGitAction } from '@/lib/safe-exec';

const WORKSPACE = process.env.OPENCLAW_DIR ? `${process.env.OPENCLAW_DIR}/workspace` : '/home/daniel/.openclaw/workspace';

interface RepoStatus {
  name: string;
  path: string;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  lastCommit: { hash: string; message: string; author: string; date: string } | null;
  remoteUrl: string;
  isDirty: boolean;
}

function getRepos(): string[] {
  const result = safeExecFile("find", [WORKSPACE, "-maxdepth", "2", "-name", ".git", "-type", "d"], {
    timeout: 10000,
  });

  if (result.status !== 0) return [];

  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((d) => d.replace('/.git', ''));
}

function getRepoStatus(repoPath: string): RepoStatus {
  const name = repoPath.split('/').pop() || repoPath;

  if (!validatePath(repoPath, WORKSPACE)) {
    return {
      name,
      path: repoPath,
      branch: 'unknown',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      lastCommit: null,
      remoteUrl: '',
      isDirty: false,
    };
  }

  const branchResult = safeExecFile("git", ["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"], {
    timeout: 5000,
  });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : 'unknown';

  let ahead = 0, behind = 0;
  const abResult = safeExecFile("git", ["-C", repoPath, "rev-list", "--left-right", "--count", "HEAD...@{upstream}"], {
    timeout: 5000,
  });
  if (abResult.status === 0) {
    const parts = abResult.stdout.trim().split('\t');
    ahead = parseInt(parts[0]) || 0;
    behind = parseInt(parts[1]) || 0;
  }

  const statusResult = safeExecFile("git", ["-C", repoPath, "status", "--porcelain"], {
    timeout: 5000,
  });
  const lines = statusResult.status === 0 ? statusResult.stdout.trim().split('\n').filter(Boolean) : [];

  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    const xy = line.slice(0, 2);
    const file = line.slice(3);
    const x = xy[0];
    const y = xy[1];

    if (x !== ' ' && x !== '?') staged.push(file);
    if (y !== ' ' && y !== '?') unstaged.push(file);
    if (xy === '??') untracked.push(file);
  }

  let lastCommit = null;
  const commitResult = safeExecFile("git", ["-C", repoPath, "log", "-1", "--format=%H|%s|%an|%ar"], {
    timeout: 5000,
  });
  if (commitResult.status === 0) {
    const parts = commitResult.stdout.trim().split('|');
    if (parts.length >= 4) {
      lastCommit = { hash: parts[0].slice(0, 8), message: parts[1], author: parts[2], date: parts[3] };
    }
  }

  let remoteUrl = '';
  const remoteResult = safeExecFile("git", ["-C", repoPath, "remote", "get-url", "origin"], {
    timeout: 5000,
  });
  if (remoteResult.status === 0) {
    remoteUrl = remoteResult.stdout.trim();
  }

  return {
    name,
    path: repoPath,
    branch,
    ahead,
    behind,
    staged,
    unstaged,
    untracked,
    lastCommit,
    remoteUrl,
    isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
  };
}

export async function GET() {
  try {
    const repos = getRepos();
    const statuses = repos.map(getRepoStatus);
    return NextResponse.json({ repos: statuses, total: statuses.length });
  } catch (error) {
    console.error('[git] Error:', error);
    return NextResponse.json({ error: 'Failed to get repos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, action } = body;

    if (!repo || !validatePath(repo, WORKSPACE)) {
      return NextResponse.json({ error: 'Invalid repo path' }, { status: 400 });
    }

    if (!action || !isValidGitAction(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'status': {
        result = safeExecFile("git", ["-C", repo, "status"], { timeout: 10000 });
        break;
      }
      case 'pull': {
        result = safeExecFile("git", ["-C", repo, "pull"], { timeout: 30000 });
        break;
      }
      case 'log': {
        result = safeExecFile("git", ["-C", repo, "log", "--oneline", "-20"], { timeout: 10000 });
        break;
      }
      case 'diff': {
        result = safeExecFile("git", ["-C", repo, "diff", "--stat"], { timeout: 10000 });
        break;
      }
    }

    const output = result?.stdout || result?.stderr || 'No output';

    return NextResponse.json({ success: true, output, repo, action });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
