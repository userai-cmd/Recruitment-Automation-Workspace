import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('users')
  listUsers(@CurrentUser() user: JwtUser) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin only');
    return this.authService.listUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Post('users')
  createUser(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin only');
    return this.authService.createRecruiter(dto.email, dto.fullName, dto.password, dto.role ?? 'recruiter');
  }

  @UseGuards(JwtAuthGuard)
  @Patch('users/:id/active')
  setUserActive(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
  ) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin only');
    return this.authService.setUserActive(id, dto.isActive);
  }
}
