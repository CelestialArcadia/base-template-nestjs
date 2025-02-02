/*
https://docs.nestjs.com/providers#services
*/

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserDto } from 'apps/user/src/users/user.dto';
import { UserService } from 'apps/user/src/users/user.service';
import { compare, hash } from 'bcrypt';
import { Response } from 'express';
import { TokenPayload } from './token-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(user: UserDto, response: Response) {
    const expiresAccessToken = new Date();
    expiresAccessToken.setSeconds(
      expiresAccessToken.getTime() +
        parseInt(this.configService.getOrThrow('JWT_EXPIRATION')),
    );

    const expiresRefreshToken = new Date();
    expiresRefreshToken.setSeconds(
      expiresRefreshToken.getTime() +
        parseInt(this.configService.getOrThrow('JWT_REFRESH_TOKEN_EXPIRATION')),
    );

    const tokenPayload: TokenPayload = {
      userId: user.id,
    };

    const accessToken = this.jwtService.sign(tokenPayload, {
      secret: this.configService.getOrThrow('JWT_SECRET'),
      expiresIn: `${this.configService.getOrThrow('JWT_EXPIRATION')}ms`,
    });

    const refreshToken = this.jwtService.sign(tokenPayload, {
      secret: this.configService.getOrThrow('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: `${this.configService.getOrThrow('JWT_REFRESH_TOKEN_EXPIRATION')}ms`,
    });

    await this.userService.update(user.id, {
      refreshToken: await hash(refreshToken, 10),
    });

    response.cookie('Authentication', accessToken, {
      httpOnly: true,
      secure: this.configService.getOrThrow('NODE_ENV') === 'production',
      expires: expiresAccessToken,
    });

    response.cookie('Refresh', refreshToken, {
      httpOnly: true,
      secure: this.configService.getOrThrow('NODE_ENV') === 'production',
      expires: expiresRefreshToken,
    });
  }

  async verifyUser(email: string, password: string) {
    try {
      const user = await this.userService.findOne({ email });
      if (!user) throw new NotFoundException('User not found');

      const authenticated = await compare(password, user.password);
      if (!authenticated) throw new UnauthorizedException();

      return user;
    } catch {
      throw new UnauthorizedException('Credentials are not valid');
    }
  }

  async verifyUserRefreshToken(refreshToken: string, userId: string) {
    try {
      const user = await this.userService.findOne({ _id: userId });
      if (!user) throw new NotFoundException('User not found');

      const authenticated = await compare(refreshToken, user.refreshToken);
      if (!authenticated) throw new UnauthorizedException();

      return user;
    } catch {
      throw new UnauthorizedException('Refresh Token is not valid');
    }
  }
}
