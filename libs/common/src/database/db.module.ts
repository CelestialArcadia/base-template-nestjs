/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrudifyModule } from 'ncrudify';

const DB_URI = process.env.MONGO_ATLAS_DB_URI;

@Module({
  imports: [
    MongooseModule.forRoot(DB_URI),
    CrudifyModule.forRoot({
      uri: DB_URI,
      logger: { dbName: process.env.MONGO_ATLAS_DB_NAME, disabled: false },
    }),
  ],
  controllers: [],
  providers: [],
})
export class DbModule {}
