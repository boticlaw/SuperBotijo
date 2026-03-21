/**
 * Integration Reauth API
 * POST /api/integrations/[id]/reauth
 * Initiates reauthentication for an integration
 */
import { NextResponse } from 'next/server';
import { safeExecFile } from '@/lib/safe-exec';

export const dynamic = 'force-dynamic';

interface ReauthResult {
  success: boolean;
  message: string;
  instructions?: string;
  timestamp: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const integrationId = decodeURIComponent(id);

  let result: ReauthResult;

  switch (integrationId) {
    case 'telegram':
      result = {
        success: true,
        message: 'Telegram reauthentication',
        instructions: 'To reauthenticate Telegram, run: openclaw telegram auth login',
        timestamp: new Date().toISOString(),
      };
      break;

    case 'twitter':
      try {
        // Try to initiate bird auth
        const birdResult = safeExecFile("bird", ["auth", "login", "--help"], {
          timeout: 5000,
        });
        
        if (birdResult.status === 0) {
          result = {
            success: true,
            message: 'Twitter reauthentication available',
            instructions: 'To reauthenticate Twitter, run: bird auth login',
            timestamp: new Date().toISOString(),
          };
        } else {
          result = {
            success: false,
            message: 'bird CLI not available',
            instructions: 'Install bird CLI first',
            timestamp: new Date().toISOString(),
          };
        }
      } catch {
        result = {
          success: false,
          message: 'bird CLI not available',
          instructions: 'Install bird CLI first',
          timestamp: new Date().toISOString(),
        };
      }
      break;

    case 'google':
      try {
        // Try to initiate gog auth
        const gogResult = safeExecFile("gog", ["auth", "login", "--help"], {
          timeout: 5000,
        });
        
        if (gogResult.status === 0) {
          result = {
            success: true,
            message: 'Google reauthentication available',
            instructions: 'To reauthenticate Google, run: gog auth login',
            timestamp: new Date().toISOString(),
          };
        } else {
          result = {
            success: false,
            message: 'gog CLI not available',
            instructions: 'Install gog CLI first',
            timestamp: new Date().toISOString(),
          };
        }
      } catch {
        result = {
          success: false,
          message: 'gog CLI not available',
          instructions: 'Install gog CLI first',
          timestamp: new Date().toISOString(),
        };
      }
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
