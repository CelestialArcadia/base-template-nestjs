/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrudifyLoggerModule } from 'ncrudify';

const DB_URI = process.env.MONGO_ATLAS_DB_URI;

@Module({
  imports: [
    MongooseModule.forRoot(DB_URI),
    CrudifyLoggerModule.forRoot({
      uri: DB_URI,
      dbName: process.env.MONGO_ATLAS_DB_NAME,
    }),
  ],
  controllers: [],
  providers: [],
})
export class DbModule {}
