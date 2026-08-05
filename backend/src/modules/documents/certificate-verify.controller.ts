import { Controller, Get, Param } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

// Public verification endpoint - deliberately its own controller with NO
// JwtAuthGuard, so anyone holding the QR link (employer, other school,
// parent) can confirm a certificate is genuine without an account. It's
// registered on "certificates/verify" so it can never collide with the
// guarded ":id" route in CertificatesController (that one only matches a
// single path segment after "certificates").
@Controller('certificates/verify')
export class CertificateVerifyController {
  constructor(private readonly service: CertificatesService) {}

  @Get(':token')
  verify(@Param('token') token: string) {
    return this.service.verify(token);
  }
}
