import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFinancialProfileDto, UpdateFinancialProfileDto } from './dto';
import { FinancialProfilesService } from './financial-profiles.service';

@Controller('financial-profiles')
@UseGuards(JwtAuthGuard)
export class FinancialProfilesController {
  constructor(private readonly service: FinancialProfilesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUser) {
    return this.service.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateFinancialProfileDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUser, @Param('id') id: string, @Body() dto: UpdateFinancialProfileDto) {
    return this.service.update(user.sub, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.service.archive(user.sub, id);
  }

  @Post(':id/switch')
  switch(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.service.switchProfile(user.sub, id);
  }
}
