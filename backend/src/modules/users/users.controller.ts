import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = { userId: string } & ScopedUser;

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(@CurrentUser() user: Requester) {
    return this.usersService.findAll(user);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findOne(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.usersService.findOne(id, user);
  }

  // Admin-assisted reset - no OTP. Director resets anyone in their own
  // school; Chairman can also reset a Director's password.
  @Patch(':id/reset-password')
  @Roles('DIRECTOR', 'ADMIN', 'CHAIRMAN')
  resetPassword(@Param('id') id: string, @Body() dto: ResetUserPasswordDto, @CurrentUser() user: Requester) {
    return this.usersService.resetPassword(id, dto.newPassword, user);
  }

  // Deactivates any login account (staff accounts not covered by /students
  // or /teachers - Director/Admin/Principal/Accountant/Librarian/Receptionist).
  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  deactivate(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.usersService.deactivate(id, user);
  }

  // Full replace of a user's roles - see UsersService.updateRoles for the
  // Director-only guard on the DIRECTOR role itself.
  @Patch(':id/roles')
  @Roles('DIRECTOR', 'ADMIN')
  updateRoles(@Param('id') id: string, @Body() dto: UpdateUserRolesDto, @CurrentUser() user: Requester) {
    return this.usersService.updateRoles(id, dto.roleNames, user);
  }
}
