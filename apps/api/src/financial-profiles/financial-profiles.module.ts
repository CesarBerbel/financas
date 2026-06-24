import { Module } from '@nestjs/common';
import { FinancialProfilesController } from './financial-profiles.controller';
import { FinancialProfilesService } from './financial-profiles.service';
@Module({ controllers: [FinancialProfilesController], providers: [FinancialProfilesService] })
export class FinancialProfilesModule {}
