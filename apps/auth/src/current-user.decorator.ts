import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// NOTE: returns the RAW hydrated User document, which still carries `password`
// and `refreshToken` as live properties. The schema `toJSON` transform strips
// them only on serialization — so never return this object straight to a client;
// map it through a DTO (or let the document's own toJSON run) for any response body.
const getCurrentUserByContext = (context: ExecutionContext) =>
  context.switchToHttp().getRequest().user;

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    getCurrentUserByContext(context),
);
