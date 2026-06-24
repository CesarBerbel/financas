import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('me')
  async me(@CurrentUser() user: CurrentUser) {
    return this.prisma.user.findUnique({ where: { id: user.sub }, select: { id: true, name: true, email: true, locale: true, timezone: true, mfaEnabled: true, createdAt: true } });
  }
}
