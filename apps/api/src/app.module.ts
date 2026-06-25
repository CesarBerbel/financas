import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AccountsModule } from './accounts/accounts.module';
import { FinancialProfilesModule } from './financial-profiles/financial-profiles.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuditModule, AuthModule, UsersModule, FinancialProfilesModule, AccountsModule] })
export class AppModule {}
