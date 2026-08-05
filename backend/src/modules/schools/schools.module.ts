import { Module } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SchoolsController } from './schools.controller';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';

@Module({
  controllers: [SchoolsController, BranchesController],
  providers: [SchoolsService, BranchesService],
})
export class SchoolsModule {}
