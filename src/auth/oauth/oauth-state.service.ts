import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuthStatePayload } from './oauth.types';

@Injectable()
export class OAuthStateService {
  constructor(private readonly jwtService: JwtService) {}

  encode(payload: OAuthStatePayload): string {
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  decode(state: string | undefined): OAuthStatePayload {
    if (!state?.trim()) {
      return {};
    }
    try {
      return this.jwtService.verify<OAuthStatePayload>(state);
    } catch {
      return {};
    }
  }
}
