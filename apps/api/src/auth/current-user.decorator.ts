import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUser = { sub: string; email: string };
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as CurrentUser);
