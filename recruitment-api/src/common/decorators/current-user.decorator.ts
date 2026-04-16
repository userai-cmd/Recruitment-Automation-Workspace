import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  id: string;
  email: string;
  role: 'admin' | 'recruiter';
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUser;
  },
);
