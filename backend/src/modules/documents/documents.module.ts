import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { CertificatesService } from './certificates.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificatesController } from './certificates.controller';
import { CertificateVerifyController } from './certificate-verify.controller';

@Module({
  controllers: [DocumentsController, CertificatesController, CertificateVerifyController],
  providers: [StorageService, DocumentsService, CertificatesService, CertificatePdfService],
})
export class DocumentsModule {}
