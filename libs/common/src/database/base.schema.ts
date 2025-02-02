import { Schema } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, _id: true })
export class BaseSchema extends Document {}
