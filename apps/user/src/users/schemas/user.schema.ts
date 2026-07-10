import { BaseSchema } from '@app/common/database/base.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Model, model } from 'mongoose';

@Schema()
export class User extends BaseSchema {
  @ApiProperty({ example: 'John Doe', description: 'The name of the user' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({
    example: 'test@gmail.com',
    description: 'The email of the user',
  })
  @Prop({ required: true, unique: true })
  email: string;

  @ApiProperty({ example: 1, description: 'The age of the user' })
  @Prop({ required: false })
  age: number;

  @Prop({ required: true })
  password: string;

  @Prop()
  refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Never expose the password / refresh-token hashes in any serialized response
// (the auto-generated CRUD returns User docs directly). The live document still
// carries these fields, so auth verification (bcrypt compare) keeps working.
const stripSecrets = (_doc: unknown, ret: Record<string, unknown>) => {
  delete ret.password;
  delete ret.refreshToken;
  return ret;
};
UserSchema.set('toJSON', { transform: stripSecrets });
UserSchema.set('toObject', { transform: stripSecrets });

export const UserModel: Model<User> = model<User>('User', UserSchema);
