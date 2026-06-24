import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUser, @Query('financialProfileId') financialProfileId?: string) {
    return this.service.list(user.sub, financialProfileId);
  }

  @Get('summary')
  summary(@CurrentUser() user: CurrentUser) {
    return this.service.summary(user.sub);
  }

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateAccountDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUser, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.update(user.sub, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.service.archive(user.sub, id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.service.close(user.sub, id);
  }
}
