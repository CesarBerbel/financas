import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTransactionDto, TransactionListFilters, UpdateTransactionDto } from './dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUser, @Query() filters: TransactionListFilters) {
    return this.service.list(user.sub, filters);
  }

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateTransactionDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUser, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user.sub, id);
  }
}
