import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { VoiceIntegrationService } from './voice-integration.service';
import { ServiceApiKeyGuard } from '../../common/guards/service-api-key.guard';

// Called only by the Voice Agent Service (school-management-system/voice-agent-service),
// as a peer service — never directly by Vapi/Claude, never by a browser. Read-only.
@Controller('voice-integration')
@UseGuards(ServiceApiKeyGuard)
export class VoiceIntegrationController {
  constructor(private readonly service: VoiceIntegrationService) {}

  // GET /voice-integration/lookup-student?admissionNo=...
  // GET /voice-integration/lookup-student?phone=...
  @Get('lookup-student')
  lookupStudent(@Query('admissionNo') admissionNo?: string, @Query('phone') phone?: string) {
    return this.service.lookupStudent({ admissionNo, phone });
  }
}
