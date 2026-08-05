import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BookIssueStatus } from '@prisma/client';
import { BookIssuesService } from './book-issues.service';
import { IssueBookDto, SettleFineDto } from './dto/issue-book.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('library/issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookIssuesController {
  constructor(private readonly service: BookIssuesService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  issue(@Body() dto: IssueBookDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.issue(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: BookIssueStatus,
    @Query('bookId') bookId?: string,
    @Query('borrowerId') borrowerId?: string,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.service.findAll(user, schoolId, status, bookId, borrowerId, overdueOnly === 'true');
  }

  // Every role can see their own borrow history/current loans - no
  // school-admin roles required here (checked by ownership, not @Roles).
  @Get('mine')
  mine(@CurrentUser() user: { userId: string }) {
    return this.service.mine(user.userId);
  }

  @Patch(':id/return')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  returnBook(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.returnBook(id, user);
  }

  @Patch(':id/lost')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  markLost(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.markLost(id, user);
  }

  @Patch(':id/settle-fine')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  settleFine(@Param('id') id: string, @Body() dto: SettleFineDto, @CurrentUser() user: ScopedUser) {
    return this.service.settleFine(id, dto, user);
  }
}
