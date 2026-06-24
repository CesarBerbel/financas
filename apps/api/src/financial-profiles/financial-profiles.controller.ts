import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFinancialProfileDto } from './dto';
import { FinancialProfilesService } from './financial-profiles.service';

@Controller('financial-profiles')
@UseGuards(JwtAuthGuard)
export class FinancialProfilesController {
  constructor(private readonly service: FinancialProfilesService) {}
  @Get() list(@CurrentUser() user: CurrentUser) { return this.service.list(user.sub); }
  @Post() create(@CurrentUser() user: CurrentUser, @Body() dto: CreateFinancialProfileDto) { return this.service.create(user.sub, dto); }
  @Post(':id/switch') switch(@CurrentUser() user: CurrentUser, @Param('id') id: string) { return this.service.switchProfile(user.sub, id); }
}
