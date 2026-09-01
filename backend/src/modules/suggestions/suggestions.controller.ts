import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { RespondSuggestionDto } from './dto/respond-suggestion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const REVIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'] as const;

@Controller('suggestions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...REVIEW_ROLES)
export class SuggestionsController {
  constructor(private readonly service: SuggestionsService) {}

  // Anyone logged in (staff, parent, student) can submit a suggestion.
  @Post()
  @Roles()
  create(@Body() dto: CreateSuggestionDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  // Open to anyone logged in - "suggestions I personally submitted".
  @Get('mine')
  @Roles()
  mine(@CurrentUser() user: Requester) {
    return this.service.mine(user);
  }

  @Get()
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.service.findAll(user, { schoolId, branchId, status, category });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondSuggestionDto, @CurrentUser() user: Requester) {
    return this.service.respond(id, dto, user);
  }
}
