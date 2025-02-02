/*
https://docs.nestjs.com/providers#services
*/

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CrudifyService } from 'ncrudify';
import { User } from './schemas/user.schema';

@Injectable()
export class UserService extends CrudifyService<User> {
  constructor(@InjectModel(User.name) protected user: Model<User>) {
    super(user);
  }
}
