import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { BookIssuesService } from './book-issues.service';
import { BookIssuesController } from './book-issues.controller';
import { StudyMaterialsService } from './study-materials.service';
import { StudyMaterialsController } from './study-materials.controller';

@Module({
  controllers: [BooksController, BookIssuesController, StudyMaterialsController],
  providers: [BooksService, BookIssuesService, StudyMaterialsService],
})
export class LibraryModule {}
