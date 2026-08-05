import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

// For trusted service-to-service calls only (the separate Voice Agent Service),
// never for browser/user traffic — that goes through JwtAuthGuard instead.
// Same single-shared-secret pattern the Voice Agent Service itself uses for its
// own Middleware-facing routes (see voice-agent-service/src/common/guards/api-key.guard.ts).
@Injectable()
export class ServiceApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-api-key'];
    const expected = process.env.VOICE_AGENT_INTEGRATION_KEY;

    if (!expected) {
      // Fail closed: if the operator forgot to set the key, refuse everything
      // rather than silently accepting unauthenticated requests.
      throw new UnauthorizedException('Server misconfigured: VOICE_AGENT_INTEGRATION_KEY not set');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing X-API-Key header');
    }
    return true;
  }
}
