import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  // Whatever is returned here becomes `request.user`
  async validate(payload: { sub: string; roles: string[]; schoolId: string | null }) {
    return { userId: payload.sub, roles: payload.roles, schoolId: payload.schoolId ?? null };
  }
}
