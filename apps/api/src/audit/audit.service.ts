import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: { userId: string; action: AuditAction; entityType: string; entityId?: string; metadata?: Prisma.InputJsonValue }) {
    await this.prisma.auditLog.create({ data: input });
  }
}
