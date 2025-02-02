/*
https://docs.nestjs.com/controllers#controllers
*/

import { Controller, UseGuards } from '@nestjs/common';
import { Crudify, CrudifyController } from 'ncrudify';
import { User } from './schemas/user.schema';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'apps/auth/src/guards/jwt-auth.guard';
import { ApiOperation } from '@nestjs/swagger';

@Crudify({
  model: {
    type: User,
  },
  routes: {
    decorators: [
      UseGuards(JwtAuthGuard),
      ApiOperation({
        summary: 'Global Operation Summary',
        description:
          'This is a global description that will apply to all routes.',
      }),
    ], // Global Swagger documentation] },
  },
})
@Controller()
export class UserController extends CrudifyController<User> {
  constructor(public service: UserService) {
    super(service);
  }

  create(createDto: Partial<User>): Promise<any> {
    return this.service.create(createDto);
  }
}
