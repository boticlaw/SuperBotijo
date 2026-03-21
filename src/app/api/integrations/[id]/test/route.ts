/**
 * Integration Test API
 * POST /api/integrations/[id]/test
 * Tests connectivity for a specific integration
 */
import { NextResponse } from 'next/server';
import { safeExecFile } from '@/lib/safe-exec';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
  timestamp: string;
}

async function testTelegram(): Promise<TestResult> {
  try {
    // Check if Telegram is configured
    const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const openclawConfig = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
    const telegramConfig = openclawConfig?.channels?.telegram;

    if (!telegramConfig?.enabled) {
      return {
        success: false,
        message: 'Telegram is not enabled',
        timestamp: new Date().toISOString(),
      };
    }

    // Get first account
    const accounts = Object.keys(telegramConfig.accounts || {});
    if (accounts.length === 0) {
      return {
        success: false,
        message: 'No Telegram accounts configured',
        timestamp: new Date().toISOString(),
      };
    }

    // Try to get bot info
    try {
      const result = safeExecFile("openclaw", ["message", "send", "--help"], {
        timeout: 5000,
      });
      
      if (result.status === 0) {
        return {
          success: true,
          message: 'Telegram CLI is available',
          details: `${accounts.length} bot(s) configured`,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          message: 'Telegram CLI not available',
          details: result.stderr || 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Telegram CLI not available',
        details: String(error),
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to test Telegram',
      details: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

async function testTwitter(): Promise<TestResult> {
  try {
    // Check if bird CLI is available
    try {
      const whichResult = safeExecFile("which", ["bird"], {
        timeout: 5000,
      });
      
      if (whichResult.status !== 0 || !whichResult.stdout.includes('bird')) {
        return {
          success: false,
          message: 'bird CLI not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Try to get user info
      try {
        const userResult = safeExecFile("bird", ["user", "show", "--json"], {
          timeout: 10000,
        });
        
        if (userResult.status === 0) {
          return {
            success: true,
            message: 'Twitter connection successful',
            details: 'bird CLI is configured',
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: false,
            message: 'Twitter authentication failed',
            details: 'Run "bird auth login" to authenticate',
            timestamp: new Date().toISOString(),
          };
        }
      } catch {
        return {
          success: false,
          message: 'Twitter authentication failed',
          details: 'Run "bird auth login" to authenticate',
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      return {
        success: false,
        message: 'bird CLI not installed',
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to test Twitter',
      details: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

async function testGoogle(): Promise<TestResult> {
  try {
    // Check if gog is available
    try {
      const whichResult = safeExecFile("which", ["gog"], {
        timeout: 5000,
      });
      
      if (whichResult.status !== 0 || !whichResult.stdout.includes('gog')) {
        return {
          success: false,
          message: 'gog CLI not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Try to get user info
      try {
        const userResult = safeExecFile("gog", ["user", "show"], {
          timeout: 10000,
        });
        
        if (userResult.status === 0) {
          return {
            success: true,
            message: 'Google connection successful',
            details: 'gog CLI is authenticated',
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: false,
            message: 'Google authentication failed',
            details: 'Run "gog auth login" to authenticate',
            timestamp: new Date().toISOString(),
          };
        }
      } catch {
        return {
          success: false,
          message: 'Google authentication failed',
          details: 'Run "gog auth login" to authenticate',
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      return {
        success: false,
        message: 'gog CLI not installed',
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to test Google',
      details: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const integrationId = decodeURIComponent(id);

  let result: TestResult;

  switch (integrationId) {
    case 'telegram':
      result = await testTelegram();
      break;
    case 'twitter':
      result = await testTwitter();
      break;
    case 'google':
      result = await testGoogle();
      break;
    default:
      result = {
        success: false,
        message: `Unknown integration: ${integrationId}`,
        timestamp: new Date().toISOString(),
      };
  }

  return NextResponse.json(result);
}
